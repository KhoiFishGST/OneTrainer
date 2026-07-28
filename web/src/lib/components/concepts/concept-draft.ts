import type { Concept } from '$lib/api/types';

function normalizeInt(val: unknown, fallback: number): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? Math.floor(val) : Number.parseInt(String(val).trim(), 10);
  return Number.isNaN(num) ? fallback : num;
}

function normalizeFloat(val: unknown, fallback: number): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number.parseFloat(String(val).trim());
  return Number.isNaN(num) ? fallback : num;
}

type PathNormalizer = {
  path: string[];
  normalize: (val: unknown) => number;
};

const NUMERIC_PATHS: PathNormalizer[] = [
  { path: ['image_variations'], normalize: (v) => normalizeInt(v, 1) },
  { path: ['text_variations'], normalize: (v) => normalizeInt(v, 1) },
  { path: ['balancing'], normalize: (v) => normalizeFloat(v, 1.0) },
  { path: ['loss_weight'], normalize: (v) => normalizeFloat(v, 1.0) },
  { path: ['image', 'random_rotate_max_angle'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['image', 'random_brightness_max_strength'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['image', 'random_contrast_max_strength'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['image', 'random_saturation_max_strength'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['image', 'random_hue_max_strength'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['text', 'keep_tags_count'], normalize: (v) => normalizeInt(v, 1) },
  { path: ['text', 'tag_dropout_probability'], normalize: (v) => normalizeFloat(v, 0.0) },
  { path: ['text', 'caps_randomize_probability'], normalize: (v) => normalizeFloat(v, 0.0) },
];

export function normalizeConceptDraft(draft: Concept): Concept {
  const result: Concept = JSON.parse(JSON.stringify(draft));

  for (const { path, normalize } of NUMERIC_PATHS) {
    let current: any = result;
    let reachable = true;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current || typeof current !== 'object' || !(path[i] in current)) {
        reachable = false;
        break;
      }
      current = current[path[i]];
    }
    if (!reachable || !current || typeof current !== 'object') continue;
    const lastKey = path[path.length - 1];
    if (!(lastKey in current)) continue;
    current[lastKey] = normalize(current[lastKey]);
  }

  return result;
}
