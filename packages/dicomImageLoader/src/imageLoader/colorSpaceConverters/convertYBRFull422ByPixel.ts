import { ByteArray } from 'dicom-parser';

export default async function (
  imageFrame: ByteArray,
  colorBuffer: ByteArray,
  useRGBA: boolean
): Promise<void> {
  if (imageFrame === undefined) {
    throw new Error('convertYBRFull422ByPixel: ybrBuffer must be defined');
  }
  if (imageFrame.length % 2 !== 0) {
    throw new Error(
      `convertYBRFull422ByPixel: ybrBuffer length ${imageFrame.length} must be divisible by 2`
    );
  }

  const numPixels = imageFrame.length / 2;

  let ybrIndex = 0;

  let bufferIndex = 0;

  if (useRGBA) {
    for (let i = 0; i < numPixels; i += 2) {
      const y1 = imageFrame[ybrIndex++];
      const y2 = imageFrame[ybrIndex++];
      const cb = imageFrame[ybrIndex++];
      const cr = imageFrame[ybrIndex++];

      colorBuffer[bufferIndex++] = y1 + 1.402 * (cr - 128); // red
      colorBuffer[bufferIndex++] =
        y1 - 0.34414 * (cb - 128) - 0.71414 * (cr - 128); // green
      colorBuffer[bufferIndex++] = y1 + 1.772 * (cb - 128); // blue
      colorBuffer[bufferIndex++] = 255; // alpha

      colorBuffer[bufferIndex++] = y2 + 1.402 * (cr - 128); // red
      colorBuffer[bufferIndex++] =
        y2 - 0.34414 * (cb - 128) - 0.71414 * (cr - 128); // green
      colorBuffer[bufferIndex++] = y2 + 1.772 * (cb - 128); // blue
      colorBuffer[bufferIndex++] = 255; // alpha
    }

    return;
  }

  for (let i = 0; i < numPixels; i += 2) {
    const y1 = imageFrame[ybrIndex++];
    const y2 = imageFrame[ybrIndex++];
    const cb = imageFrame[ybrIndex++];
    const cr = imageFrame[ybrIndex++];

    colorBuffer[bufferIndex++] = y1 + 1.402 * (cr - 128); // red
    colorBuffer[bufferIndex++] =
      y1 - 0.34414 * (cb - 128) - 0.71414 * (cr - 128); // green
    colorBuffer[bufferIndex++] = y1 + 1.772 * (cb - 128); // blue

    colorBuffer[bufferIndex++] = y2 + 1.402 * (cr - 128); // red
    colorBuffer[bufferIndex++] =
      y2 - 0.34414 * (cb - 128) - 0.71414 * (cr - 128); // green
    colorBuffer[bufferIndex++] = y2 + 1.772 * (cb - 128); // blue
  }
}
