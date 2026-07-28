import { describe, expect, it } from 'vitest';
import { normalizeConceptDraft } from './concept-draft';
import type { Concept } from '$lib/api/types';

describe('normalizeConceptDraft', () => {
  it('converts raw valid numeric string drafts to numbers across all 12 paths without mutating source', () => {
    const rawDraft: any = {
      name: 'Test Concept',
      image_variations: '3',
      text_variations: '2',
      balancing: '0.8',
      loss_weight: '1.5',
      image: {
        random_rotate_max_angle: '15.5',
        random_brightness_max_strength: '0.2',
        random_contrast_max_strength: '0.1',
        random_saturation_max_strength: '0.3',
        random_hue_max_strength: '0.05',
      },
      text: {
        keep_tags_count: '2',
        tag_dropout_probability: '0.15',
        caps_randomize_probability: '0.05',
      },
    };

    const normalized = normalizeConceptDraft(rawDraft as Concept);

    // Source draft must not be mutated
    expect(rawDraft.image_variations).toBe('3');
    expect(rawDraft.image.random_rotate_max_angle).toBe('15.5');
    expect(rawDraft.text.keep_tags_count).toBe('2');

    // Normalized concept contains parsed numbers
    expect(normalized.image_variations).toBe(3);
    expect(normalized.text_variations).toBe(2);
    expect(normalized.balancing).toBe(0.8);
    expect(normalized.loss_weight).toBe(1.5);
    expect(normalized.image?.random_rotate_max_angle).toBe(15.5);
    expect(normalized.image?.random_brightness_max_strength).toBe(0.2);
    expect(normalized.image?.random_contrast_max_strength).toBe(0.1);
    expect(normalized.image?.random_saturation_max_strength).toBe(0.3);
    expect(normalized.image?.random_hue_max_strength).toBe(0.05);
    expect(normalized.text?.keep_tags_count).toBe(2);
    expect(normalized.text?.tag_dropout_probability).toBe(0.15);
    expect(normalized.text?.caps_randomize_probability).toBe(0.05);
  });

  it('applies fallback defaults for invalid, empty, or incomplete string values', () => {
    const invalidDraft: any = {
      image_variations: 'invalid',
      text_variations: '',
      balancing: '-',
      loss_weight: 'abc',
      image: {
        random_rotate_max_angle: '',
        random_brightness_max_strength: 'invalid',
        random_contrast_max_strength: '-',
        random_saturation_max_strength: 'xyz',
        random_hue_max_strength: '',
      },
      text: {
        keep_tags_count: 'invalid',
        tag_dropout_probability: '',
        caps_randomize_probability: '-',
      },
    };

    const normalized = normalizeConceptDraft(invalidDraft as Concept);

    expect(normalized.image_variations).toBe(1);
    expect(normalized.text_variations).toBe(1);
    expect(normalized.balancing).toBe(1.0);
    expect(normalized.loss_weight).toBe(1.0);
    expect(normalized.image?.random_rotate_max_angle).toBe(0.0);
    expect(normalized.image?.random_brightness_max_strength).toBe(0.0);
    expect(normalized.image?.random_contrast_max_strength).toBe(0.0);
    expect(normalized.image?.random_saturation_max_strength).toBe(0.0);
    expect(normalized.image?.random_hue_max_strength).toBe(0.0);
    expect(normalized.text?.keep_tags_count).toBe(1);
    expect(normalized.text?.tag_dropout_probability).toBe(0.0);
    expect(normalized.text?.caps_randomize_probability).toBe(0.0);
  });
});
