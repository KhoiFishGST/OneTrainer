import { expect, test } from 'vitest';
import { isPlayableInBrowser, UPLOAD_ACCEPT } from './media-kind';

test('only browser-playable containers report as playable', () => {
  for (const name of ['clip.mp4', 'clip.webm', 'clip.m4v', 'clip.MOV']) {
    expect(isPlayableInBrowser(name)).toBe(true);
  }
  for (const name of ['clip.mkv', 'clip.avi', 'clip.wmv', 'clip.flv', 'clip.mpeg']) {
    expect(isPlayableInBrowser(name)).toBe(false);
  }
});

test('accept string covers images, videos, and captions', () => {
  expect(UPLOAD_ACCEPT).toContain('.mp4');
  expect(UPLOAD_ACCEPT).toContain('.mkv');
  expect(UPLOAD_ACCEPT).toContain('.png');
  expect(UPLOAD_ACCEPT).toContain('.txt');
});
