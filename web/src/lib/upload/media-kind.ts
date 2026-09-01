export type MediaKind = 'image' | 'video' | 'text';

/** Mirrors path_util.SUPPORTED_VIDEO_EXTENSIONS. */
export const VIDEO_EXTENSIONS = [
  '.webm', '.mkv', '.flv', '.avi', '.mov', '.wmv', '.mp4', '.mpeg', '.m4v',
];

/** Mirrors path_util.SUPPORTED_IMAGE_EXTENSIONS. */
export const IMAGE_EXTENSIONS = [
  '.bmp', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.avif',
];

const CAPTION_EXTENSIONS = ['.txt', '.caption'];

/**
 * Containers browsers can actually play. The others are valid for training
 * but have no native decoder, so we show a poster and a explanatory notice.
 */
const PLAYABLE_EXTENSIONS = ['.mp4', '.webm', '.m4v', '.mov'];

export const UPLOAD_ACCEPT = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...CAPTION_EXTENSIONS,
].join(',');

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function isPlayableInBrowser(filename: string): boolean {
  return PLAYABLE_EXTENSIONS.includes(extensionOf(filename));
}
