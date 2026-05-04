import { Enums } from '@cornerstonejs/core';
import findIndexOfString from './findIndexOfString';

const { ImageQualityStatus } = Enums;
/**
 * Extracts multipart/related data or single part data from a response byte
 * array.
 *
 * @param contentType - guess of the root content type
 * @param imageFrameAsArrayBuffer - array buffer containing the image frame
 * @param options - contains already computed values from
 *        earlier calls, allowing additional calls to be made to fetch
 *        additional data.
 * @param isPartial - indicates the file may end partially
 * @returns a compressed image frame containing the pixel data.
 */
export default function extractMultipart(
  contentType: string,
  imageFrameAsArrayBuffer,
  options?
) {
  options ||= {};
  // request succeeded, Parse the multi-part mime response
  const response = new Uint8Array(imageFrameAsArrayBuffer);
  const isPartial = !!options?.isPartial;
  if (contentType.indexOf('multipart') === -1) {
    return {
      contentType,
      imageQualityStatus: isPartial
        ? ImageQualityStatus.SUBRESOLUTION
        : ImageQualityStatus.FULL_RESOLUTION,
      pixelData: response,
    };
  }

  let { tokenIndex, responseHeaders, boundary, multipartContentType } = options;

  // First look for the multipart mime header
  tokenIndex ||= findIndexOfString(response, '\r\n\r\n');

  if (tokenIndex === -1) {
    throw new Error('invalid response - no multipart mime header');
  }

  if (!boundary) {
    const header = uint8ArrayToString(response, 0, tokenIndex);
    // Now find the boundary  marker
    responseHeaders = header.split('\r\n');
    boundary = findBoundary(responseHeaders);

    if (!boundary) {
      throw new Error('invalid response - no boundary marker');
    }
  }
  const offset = tokenIndex + 4; // skip over the \r\n\r\n

  // find the terminal boundary marker
  const endIndex = findIndexOfString(response, boundary, offset);

  if (endIndex === -1 && !isPartial) {
    throw new Error('invalid response - terminating boundary not found');
  }

  multipartContentType ||= findContentType(responseHeaders);

  options.tokenIndex = tokenIndex;
  options.boundary = boundary;
  options.responseHeaders = responseHeaders;
  options.multipartContentType = multipartContentType;
  options.isPartial = endIndex === -1;

  // return the info for this pixel data
  return {
    contentType: multipartContentType,
    // done indicates if the read has finished the entire image, not if
    // the image is completely available
    extractDone: !isPartial || endIndex !== -1,
    tokenIndex,
    responseHeaders,
    boundary,
    multipartContentType,
    // Exclude the \r\n as well as the boundary
    pixelData: imageFrameAsArrayBuffer.slice(offset, endIndex - 2),
  };
}

export function findBoundary(header: string[]): string {
  for (let i = 0; i < header.length; i++) {
    if (header[i].substr(0, 2) === '--') {
      return header[i];
    }
  }
}

export function findContentType(header: string[]): string {
  for (let i = 0; i < header.length; i++) {
    if (header[i].substr(0, 13) === 'Content-Type:') {
      return header[i].substr(13).trim();
    }
  }
}

export function uint8ArrayToString(data, offset, length) {
  offset = offset || 0;
  length = length || data.length - offset;
  let str = '';

  for (let i = offset; i < offset + length; i++) {
    str += String.fromCharCode(data[i]);
  }

  return str;
}

export interface ExtractedFrame {
  contentType: string;
  pixelData: ArrayBuffer;
}

/**
 * Extracts all parts from a multipart/related response.
 * Each part corresponds to one frame's pixel data.
 *
 * @param contentType - the Content-Type header from the HTTP response
 * @param imageFrameAsArrayBuffer - the full response body
 * @returns an array of extracted frames with their content type and pixel data
 */
export function extractAllMultipartParts(
  contentType: string,
  imageFrameAsArrayBuffer: ArrayBuffer
): ExtractedFrame[] {
  const response = new Uint8Array(imageFrameAsArrayBuffer);

  if (!contentType.includes('multipart')) {
    return [{ contentType, pixelData: imageFrameAsArrayBuffer }];
  }

  const parts: ExtractedFrame[] = [];
  let searchOffset = 0;

  // Find the boundary string from the first part's headers
  const firstHeaderEnd = findIndexOfString(response, '\r\n\r\n', 0);
  if (firstHeaderEnd === -1) {
    throw new Error('invalid response - no multipart mime header');
  }

  const firstHeader = uint8ArrayToString(response, 0, firstHeaderEnd);
  const headerLines = firstHeader.split('\r\n');
  const boundary = findBoundary(headerLines);
  if (!boundary) {
    throw new Error('invalid response - no boundary marker');
  }

  // Iterate over each part
  while (searchOffset < response.length) {
    // Find the next part header end
    const headerEnd = findIndexOfString(response, '\r\n\r\n', searchOffset);
    if (headerEnd === -1) {
      break;
    }

    // Parse headers for this part
    const partHeader = uint8ArrayToString(
      response,
      searchOffset,
      headerEnd - searchOffset
    );
    const partHeaderLines = partHeader.split('\r\n');
    const partContentType = findContentType(partHeaderLines) || contentType;

    const dataStart = headerEnd + 4; // skip \r\n\r\n

    // Find the next boundary after the data
    const nextBoundary = findIndexOfString(response, boundary, dataStart);
    if (nextBoundary === -1) {
      // Last part - take remaining data (minus trailing \r\n if present)
      const endOffset =
        response.length >= 2 &&
        response.at(-2) === 0x0d &&
        response.at(-1) === 0x0a
          ? response.length - 2
          : response.length;
      if (dataStart < endOffset) {
        parts.push({
          contentType: partContentType,
          pixelData: imageFrameAsArrayBuffer.slice(dataStart, endOffset),
        });
      }
      break;
    }

    // Exclude the \r\n before the boundary
    const dataEnd = nextBoundary - 2;
    if (dataStart < dataEnd) {
      parts.push({
        contentType: partContentType,
        pixelData: imageFrameAsArrayBuffer.slice(dataStart, dataEnd),
      });
    }

    // Move past the boundary line to the next part
    searchOffset = nextBoundary + boundary.length;
    // Skip \r\n after boundary
    if (
      searchOffset + 1 < response.length &&
      response[searchOffset] === 0x0d &&
      response[searchOffset + 1] === 0x0a
    ) {
      searchOffset += 2;
    }
  }

  return parts;
}
