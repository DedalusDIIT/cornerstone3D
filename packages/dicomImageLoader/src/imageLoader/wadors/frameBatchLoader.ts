import { xhrRequest } from '../internal/index';
import { extractAllMultipartParts } from './extractMultipart';
import { getImageQualityStatus } from './getImageQualityStatus';

export interface CachedFrame {
  contentType: string;
  pixelData: Uint8Array;
  imageQualityStatus: number;
}

interface PendingBatch {
  frameNumbers: number[];
  promises: Map<
    number,
    { resolve: (v: CachedFrame) => void; reject: (e: unknown) => void }
  >;
}

// Cache of already-fetched frames keyed by instanceUrl + frameNumber
const frameCache = new Map<string, CachedFrame>();

// In-flight fetch promises keyed by instanceUrl — so concurrent requests
// for frames of the same instance share a single HTTP request.
const inflightFetches = new Map<string, Promise<void>>();

// Pending frames collected within the current microtask, keyed by instanceUrl
const pendingBatches = new Map<string, PendingBatch>();

let batchSize = 10;
let batchEnabled = true;

/**
 * Set the number of frames to request per batch HTTP call.
 * Set to 1 to effectively disable batching (one request per frame).
 */
export function setFrameBatchSize(size: number): void {
  batchSize = Math.max(1, size);
}

export function getFrameBatchSize(): number {
  return batchSize;
}

/**
 * Enable or disable frame list batching entirely.
 * When disabled, each frame is fetched individually.
 */
export function setFrameBatchEnabled(enabled: boolean): void {
  batchEnabled = enabled;
}

export function getFrameBatchEnabled(): boolean {
  return batchEnabled;
}

/** Clear the frame cache (e.g. when switching studies). */
export function clearFrameCache(): void {
  frameCache.clear();
}

function cacheKey(instanceUrl: string, frameNumber: number): string {
  return `${instanceUrl}|${frameNumber}`;
}

/**
 * Parse a wadors URI to extract the instance base URL and frame number.
 * Returns null if the URI doesn't contain /frames/<number>.
 */
export function parseFrameUri(uri: string): {
  instanceUrl: string;
  frameNumber: number;
} | null {
  const framesIdx = uri.lastIndexOf('/frames/');
  if (framesIdx === -1) {
    return null;
  }
  const instanceUrl = uri.substring(0, framesIdx);
  const frameStr = uri.substring(framesIdx + 8);
  // If this is already a frame list (contains comma), don't batch
  if (frameStr.includes(',')) {
    return null;
  }
  const frameNumber = Number.parseInt(frameStr, 10);
  if (Number.isNaN(frameNumber)) {
    return null;
  }
  return { instanceUrl, frameNumber };
}

/**
 * Get pixel data for a single frame, automatically batching the HTTP request
 * with other frames from the same instance requested in the same microtask.
 *
 * Returns null if batching is not applicable (not a /frames/N URL, or disabled).
 */
export function getFrameBatchPixelData(
  uri: string,
  imageId: string,
  mediaType: string,
  retrieveOptions?: unknown
): Promise<CachedFrame> | null {
  if (!batchEnabled) {
    return null;
  }

  const parsed = parseFrameUri(uri);
  if (!parsed) {
    return null;
  }

  const { instanceUrl, frameNumber } = parsed;
  const key = cacheKey(instanceUrl, frameNumber);

  // Already cached from a previous batch
  const cached = frameCache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise<CachedFrame>((resolve, reject) => {
    let batch = pendingBatches.get(instanceUrl);
    if (!batch) {
      batch = { frameNumbers: [], promises: new Map() };
      pendingBatches.set(instanceUrl, batch);

      // Schedule flush at end of microtask
      queueMicrotask(() => flushBatch(instanceUrl, mediaType, retrieveOptions));
    }

    batch.frameNumbers.push(frameNumber);
    batch.promises.set(frameNumber, { resolve, reject });
  });
}

function flushBatch(
  instanceUrl: string,
  mediaType: string,
  retrieveOptions?: unknown
): void {
  const batch = pendingBatches.get(instanceUrl);
  if (!batch) {
    return;
  }
  pendingBatches.delete(instanceUrl);

  // Sort frames for consistent ordering
  const allFrames = [...batch.frameNumbers].sort((a, b) => a - b);

  // Split into chunks of batchSize
  const chunks: number[][] = [];
  for (let i = 0; i < allFrames.length; i += batchSize) {
    chunks.push(allFrames.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    void fetchFrameChunk(
      instanceUrl,
      chunk,
      batch.promises,
      mediaType,
      retrieveOptions
    );
  }
}

async function fetchFrameChunk(
  instanceUrl: string,
  frameNumbers: number[],
  promises: Map<
    number,
    { resolve: (v: CachedFrame) => void; reject: (e: unknown) => void }
  >,
  mediaType: string,
  retrieveOptions?: unknown
): Promise<void> {
  const frameList = frameNumbers.join(',');
  const url = `${instanceUrl}/frames/${frameList}`;
  const headers = { Accept: mediaType };
  // Use first frame's imageId for the XHR (needed for beforeSend)
  const imageId = `wadors:${instanceUrl}/frames/${frameNumbers[0]}`;

  try {
    const loadPromise = xhrRequest(url, imageId, headers);
    const { xhr } = loadPromise;
    const arrayBuffer = await loadPromise;

    const contentType =
      xhr.getResponseHeader('Content-Type') || 'application/octet-stream';
    const imageQualityStatus = getImageQualityStatus(
      retrieveOptions || ({} as Record<string, unknown>),
      true
    );

    const parts = extractAllMultipartParts(contentType, arrayBuffer);

    if (parts.length === frameNumbers.length) {
      // Parts correspond 1:1 with requested frames
      for (let i = 0; i < frameNumbers.length; i++) {
        const frame: CachedFrame = {
          contentType: parts[i].contentType,
          pixelData: new Uint8Array(parts[i].pixelData),
          imageQualityStatus,
        };
        const key = cacheKey(instanceUrl, frameNumbers[i]);
        frameCache.set(key, frame);
        promises.get(frameNumbers[i])?.resolve(frame);
      }
    } else if (parts.length === 1 && frameNumbers.length > 1) {
      // Server didn't support frame list — resolve first, fetch rest individually
      const frame: CachedFrame = {
        contentType: parts[0].contentType,
        pixelData: new Uint8Array(parts[0].pixelData),
        imageQualityStatus,
      };
      const key = cacheKey(instanceUrl, frameNumbers[0]);
      frameCache.set(key, frame);
      promises.get(frameNumbers[0])?.resolve(frame);

      // Fetch remaining frames individually
      for (let i = 1; i < frameNumbers.length; i++) {
        void fetchFrameChunk(
          instanceUrl,
          [frameNumbers[i]],
          promises,
          mediaType,
          retrieveOptions
        );
      }
    } else {
      // Unexpected count — fall back to individual requests
      for (const fn of frameNumbers) {
        void fetchFrameChunk(
          instanceUrl,
          [fn],
          promises,
          mediaType,
          retrieveOptions
        );
      }
    }
  } catch (error) {
    // If batch fails, try each frame individually
    if (frameNumbers.length > 1) {
      for (const fn of frameNumbers) {
        void fetchFrameChunk(
          instanceUrl,
          [fn],
          promises,
          mediaType,
          retrieveOptions
        );
      }
    } else {
      // Single frame failed — reject its promise
      for (const fn of frameNumbers) {
        promises.get(fn)?.reject(error);
      }
    }
  }
}
