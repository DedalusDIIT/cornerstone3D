export interface CornerstoneImageUrl {
  scheme: string;
  url: string;
  frame: number;
  pixelDataFrame: number;
}

// build a url by parsing out the url scheme and frame index from the imageId
function parseImageId(imageId: string): CornerstoneImageUrl {
  if (!imageId) {
    return {
      scheme: '',
      url: '',
      frame: 0,
      pixelDataFrame: 0,
    };
  }

  const firstColonIndex = imageId.indexOf(':');
  const scheme = imageId.substring(0, firstColonIndex);
  let url = imageId.substring(firstColonIndex + 1);
  const contentTypeMatch = url.match(/(&contentType=[^&]*)/);
  const transferSyntaxMatch = url.match(/(&transferSyntax=[^&]*)/);

  // Identify and parse the frame index
  const framePatterns = [
    { pattern: 'frame=', offset: 'frame='.length },
    { pattern: 'frames/', offset: 'frames/'.length },
    { pattern: 'simpleFrameList=', offset: 'simpleFrameList='.length },
    { pattern: 'frameNumber=', offset: 'frameNumber='.length },
  ];

  let frame: number | undefined;
  framePatterns.some(({ pattern, offset }) => {
    const frameIndex = url.indexOf(pattern);
    if (frameIndex !== -1) {
      frame = parseInt(url.substring(frameIndex + offset), 10);
      url = url.substring(0, frameIndex - 1); // Remove frame part from the URL
      if (contentTypeMatch) {
        url += contentTypeMatch[1];
      }
      if (transferSyntaxMatch) {
        url += transferSyntaxMatch[1];
      }
      return true;
    }
    return false;
  });

  /**
   * Why we adjust frameNumber? since in the above we are extracting the
   * frame number from the imageId (from the metadata), and the frame number
   * starts from 1, but in the loader which uses the dicomParser
   * the frame number starts from 0.
   */
  const pixelDataFrame = frame !== undefined ? frame - 1 : undefined;

  return { scheme, url, frame, pixelDataFrame };
}

export default parseImageId;
