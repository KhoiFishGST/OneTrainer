<script lang="ts">
  import type { ConceptImageConfig } from '$lib/api/types';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { Button } from '$lib/components/ui/button';
  import { Eye } from 'lucide-svelte';

  let {
    image = $bindable(),
    onOpenPreview,
  }: {
    image: ConceptImageConfig;
    onOpenPreview: () => void;
  } = $props();
</script>

<div class="aug-tab-container">
  <div class="aug-matrix-wrapper">
    <div class="aug-matrix-header">
      <div class="col-lbl">Augmentation Feature</div>
      <div class="col-sw">Random</div>
      <div class="col-sw">Fixed</div>
      <div class="col-val">Value / Max Strength</div>
    </div>

    <!-- Crop Jitter -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Enables random cropping of samples">Crop Jitter</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-crop-jitter"
          value={image.enable_crop_jitter}
          onChange={(v) => (image.enable_crop_jitter = v)}
        />
      </div>
      <div class="col-sw">-</div>
      <div class="col-val">-</div>
    </div>

    <!-- Random / Fixed Flip -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Randomly or fixed flip sample during training">Flip</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-flip"
          value={image.enable_random_flip}
          onChange={(v) => (image.enable_random_flip = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-flip"
          value={image.enable_fixed_flip}
          onChange={(v) => (image.enable_fixed_flip = v)}
        />
      </div>
      <div class="col-val">-</div>
    </div>

    <!-- Rotation -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Rotates the sample during training">Rotation</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-rot"
          value={image.enable_random_rotate}
          onChange={(v) => (image.enable_random_rotate = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-rot"
          value={image.enable_fixed_rotate}
          onChange={(v) => (image.enable_fixed_rotate = v)}
        />
      </div>
      <div class="col-val">
        <NumberInput
          id="aug-matrix-rot-angle"
          value={image.random_rotate_max_angle}
          onInput={(v) => (image.random_rotate_max_angle = parseFloat(v) || 0)}
          placeholder="Angle (°)"
        />
      </div>
    </div>

    <!-- Brightness -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Adjusts brightness of sample during training">Brightness</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-bright"
          value={image.enable_random_brightness}
          onChange={(v) => (image.enable_random_brightness = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-bright"
          value={image.enable_fixed_brightness}
          onChange={(v) => (image.enable_fixed_brightness = v)}
        />
      </div>
      <div class="col-val">
        <NumberInput
          id="aug-matrix-bright-strength"
          value={image.random_brightness_max_strength}
          onInput={(v) => (image.random_brightness_max_strength = parseFloat(v) || 0)}
          placeholder="Max Strength"
        />
      </div>
    </div>

    <!-- Contrast -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Adjusts contrast of sample during training">Contrast</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-contrast"
          value={image.enable_random_contrast}
          onChange={(v) => (image.enable_random_contrast = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-contrast"
          value={image.enable_fixed_contrast}
          onChange={(v) => (image.enable_fixed_contrast = v)}
        />
      </div>
      <div class="col-val">
        <NumberInput
          id="aug-matrix-contrast-strength"
          value={image.random_contrast_max_strength}
          onInput={(v) => (image.random_contrast_max_strength = parseFloat(v) || 0)}
          placeholder="Max Strength"
        />
      </div>
    </div>

    <!-- Saturation -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Adjusts saturation of sample during training">Saturation</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-sat"
          value={image.enable_random_saturation}
          onChange={(v) => (image.enable_random_saturation = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-sat"
          value={image.enable_fixed_saturation}
          onChange={(v) => (image.enable_fixed_saturation = v)}
        />
      </div>
      <div class="col-val">
        <NumberInput
          id="aug-matrix-sat-strength"
          value={image.random_saturation_max_strength}
          onInput={(v) => (image.random_saturation_max_strength = parseFloat(v) || 0)}
          placeholder="Max Strength"
        />
      </div>
    </div>

    <!-- Hue -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Adjusts hue of sample during training">Hue</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rand-hue"
          value={image.enable_random_hue}
          onChange={(v) => (image.enable_random_hue = v)}
        />
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-fixed-hue"
          value={image.enable_fixed_hue}
          onChange={(v) => (image.enable_fixed_hue = v)}
        />
      </div>
      <div class="col-val">
        <NumberInput
          id="aug-matrix-hue-strength"
          value={image.random_hue_max_strength}
          onInput={(v) => (image.random_hue_max_strength = parseFloat(v) || 0)}
          placeholder="Max Strength"
        />
      </div>
    </div>

    <!-- Circular Mask Generation -->
    <div class="aug-matrix-row">
      <div class="col-lbl" title="Automatically create circular masks for masked training">
        Circular Mask Generation
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-circular-mask"
          value={image.enable_random_circular_mask_shrink}
          onChange={(v) => (image.enable_random_circular_mask_shrink = v)}
        />
      </div>
      <div class="col-sw">-</div>
      <div class="col-val">-</div>
    </div>

    <!-- Random Rotate & Crop -->
    <div class="aug-matrix-row">
      <div
        class="col-lbl"
        title="Randomly rotate training samples and crop to masked region"
      >
        Random Rotate & Crop
      </div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-rotate-crop"
          value={image.enable_random_mask_rotate_crop}
          onChange={(v) => (image.enable_random_mask_rotate_crop = v)}
        />
      </div>
      <div class="col-sw">-</div>
      <div class="col-val">-</div>
    </div>

    <!-- Resolution Override -->
    <div class="aug-matrix-row">
      <div
        class="col-lbl"
        title="Override resolution for this concept in format <width>x<height>"
      >
        Resolution Override
      </div>
      <div class="col-sw">-</div>
      <div class="col-sw">
        <Toggle
          id="aug-matrix-res-override-toggle"
          value={image.enable_resolution_override}
          onChange={(v) => (image.enable_resolution_override = v)}
        />
      </div>
      <div class="col-val">
        {#if image.enable_resolution_override}
          <TextInput
            id="aug-matrix-res-override-val"
            value={image.resolution_override || ''}
            onInput={(v) => (image.resolution_override = v)}
            placeholder="512x512"
          />
        {:else}
          <span class="muted-dash">-</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="aug-bottom-action-bar">
    <Button
      type="button"
      class="btn-aug-preview-compact"
      onclick={onOpenPreview}
    >
      <Eye size={14} />
      <span>Preview</span>
    </Button>
  </div>
</div>

<style>
  .aug-tab-container {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .aug-matrix-wrapper {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    background: var(--panel, #181e25);
  }

  .aug-matrix-header {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr 0.8fr 1.6fr;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: var(--panel-raised, #1d242c);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted, #94a3b8);
  }

  .aug-matrix-header .col-sw {
    text-align: center;
  }

  .aug-matrix-row {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr 0.8fr 1.6fr;
    gap: 0.5rem;
    align-items: center;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .aug-matrix-row:last-child {
    border-bottom: none;
  }

  .aug-matrix-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .col-lbl {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text, #e6ebef);
  }

  .col-sw {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted, #94a3b8);
  }

  .col-val {
    display: flex;
    align-items: center;
  }

  .aug-bottom-action-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 0.25rem;
  }

  .aug-bottom-action-bar :global(.btn-aug-preview-compact) {
    min-height: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.75rem;
    background: var(--accent, #3b82f6);
    border: 1px solid var(--accent, #3b82f6);
    border-radius: 5px;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .aug-bottom-action-bar :global(.btn-aug-preview-compact:hover) {
    opacity: 0.9;
  }
</style>
