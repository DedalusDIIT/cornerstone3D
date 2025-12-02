import { metaData, registerImageLoader, type Types } from '@cornerstonejs/core';
import { loadImage } from '../wadouri/loadImage';
import { metaDataProvider } from '../wadouri/metaData/index';

export default function () {
  // register wadors scheme and metadata provider
  registerImageLoader('wadors', loadImage as unknown as Types.ImageLoaderFn);
  metaData.addProvider(metaDataProvider);
}
