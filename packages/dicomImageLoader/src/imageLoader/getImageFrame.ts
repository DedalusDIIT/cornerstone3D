import type { Types } from '@cornerstonejs/core';
import { metaData } from '@cornerstonejs/core';

//
function getImageFrame(imageId: string): Types.IImageFrame {
  const imagePixelModule: Types.ImagePixelModuleMetadata = metaData.get(
    'imagePixelModule',
    imageId
  );

  // Some modalities (e.g. IVOCT) store pixel data as MONOCHROME2 but signal
  // that the image must be displayed with a color palette via Pixel Presentation
  // (0008,9205) = 'COLOR' and the presence of palette LUT descriptors.
  // Override photometricInterpretation to 'PALETTE COLOR' so the image is
  // routed through the correct colour-rendering path in createImage.
  // Guarded additionally on IVOCT SOP Class UIDs to prevent any other MONOCHROME2
  // series that coincidentally carry these attributes from being misclassified.
  const sopCommonModule = metaData.get('sopCommonModule', imageId) || {};
  const isIVOCT =
    sopCommonModule.sopClassUID === '1.2.840.10008.5.1.4.1.1.14.1' ||
    sopCommonModule.sopClassUID === '1.2.840.10008.5.1.4.1.1.14.2';

  const photometricInterpretation =
    imagePixelModule.photometricInterpretation === 'MONOCHROME2' &&
    imagePixelModule.pixelPresentation === 'COLOR' &&
    isIVOCT &&
    imagePixelModule.redPaletteColorLookupTableDescriptor?.length
      ? 'PALETTE COLOR'
      : imagePixelModule.photometricInterpretation;

  return {
    samplesPerPixel: imagePixelModule.samplesPerPixel,
    photometricInterpretation,
    planarConfiguration: imagePixelModule.planarConfiguration,
    rows: imagePixelModule.rows,
    columns: imagePixelModule.columns,
    bitsAllocated: imagePixelModule.bitsAllocated,
    bitsStored: imagePixelModule.bitsStored,
    pixelRepresentation: imagePixelModule.pixelRepresentation, // 0 = unsigned,
    smallestPixelValue: imagePixelModule.smallestPixelValue,
    largestPixelValue: imagePixelModule.largestPixelValue,
    redPaletteColorLookupTableDescriptor:
      imagePixelModule.redPaletteColorLookupTableDescriptor,
    greenPaletteColorLookupTableDescriptor:
      imagePixelModule.greenPaletteColorLookupTableDescriptor,
    bluePaletteColorLookupTableDescriptor:
      imagePixelModule.bluePaletteColorLookupTableDescriptor,
    redPaletteColorLookupTableData:
      imagePixelModule.redPaletteColorLookupTableData,
    greenPaletteColorLookupTableData:
      imagePixelModule.greenPaletteColorLookupTableData,
    bluePaletteColorLookupTableData:
      imagePixelModule.bluePaletteColorLookupTableData,
    pixelData: undefined, // populated later after decoding
    imageId,
  };
}

export default getImageFrame;
