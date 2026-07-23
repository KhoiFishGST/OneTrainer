<script lang="ts">
  import { X, Image as ImageIcon, ZoomIn } from 'lucide-svelte';
  import type { TrainingSample } from '../../api/types';

  let {
    samples = [],
  } = $props<{
    samples?: TrainingSample[];
  }>();

  let selectedStepLimit = $state<number | null>(null);
  let selectedSample = $state<TrainingSample | null>(null);

  const maxStep = $derived(
    samples.length > 0 ? Math.max(...samples.map((s: TrainingSample) => s.step ?? 0)) : 0
  );
  const minStep = $derived(
    samples.length > 0 ? Math.min(...samples.map((s: TrainingSample) => s.step ?? 0)) : 0
  );

  const currentScrubberVal = $derived(
    selectedStepLimit !== null ? selectedStepLimit : maxStep
  );

  const filteredSamples = $derived(
    samples.filter((s: TrainingSample) => (s.step ?? 0) <= currentScrubberVal)
  );

  function handleScrubberInput(e: Event) {
    const target = e.target as HTMLInputElement;
    selectedStepLimit = Number(target.value);
  }

  function handleResetScrubber() {
    selectedStepLimit = maxStep;
  }

  function openLightbox(sample: TrainingSample) {
    selectedSample = sample;
  }

  function closeLightbox() {
    selectedSample = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectedSample) {
      closeLightbox();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="sample-gallery-panel" data-testid="sample-gallery">
  <div class="gallery-header">
    <div class="header-left">
      <h3 class="panel-title">Live Sample Gallery</h3>
      {#if samples.length > 0}
        <span class="sample-count-badge">{filteredSamples.length} / {samples.length} samples</span>
      {/if}
    </div>

    {#if samples.length > 0}
      <div class="scrubber-container">
        <label for="step-scrubber-input" class="scrubber-label">
          Step Timeline: <span class="scrubber-value">{currentScrubberVal}</span> / {maxStep}
        </label>
        <div class="scrubber-controls">
          <span class="step-limit-min">{minStep}</span>
          <input
            id="step-scrubber-input"
            type="range"
            aria-label="Timeline step scrubber"
            min={minStep}
            max={maxStep}
            value={currentScrubberVal}
            oninput={handleScrubberInput}
            class="timeline-scrubber"
          />
          <span class="step-limit-max">{maxStep}</span>
          {#if selectedStepLimit !== null && selectedStepLimit !== maxStep}
            <button
              type="button"
              class="reset-scrubber-btn"
              onclick={handleResetScrubber}
              title="Reset scrubber to latest"
            >
              Latest
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if samples.length === 0}
    <div class="empty-gallery">
      <ImageIcon size={48} class="empty-icon" />
      <p class="empty-text">No samples generated yet</p>
      <p class="empty-subtext">Generated preview images during training will appear here automatically.</p>
    </div>
  {:else if filteredSamples.length === 0}
    <div class="empty-gallery">
      <p class="empty-text">No samples match the selected step filter ({currentScrubberVal})</p>
      <button type="button" class="btn reset-btn" onclick={handleResetScrubber}>
        Reset Filter
      </button>
    </div>
  {:else}
    <div class="samples-grid">
      {#each filteredSamples as sample (sample.id || sample.sample_id || `step-${sample.step}-${sample.seed}`)}
        <div
          class="sample-card"
          onclick={() => openLightbox(sample)}
          onkeydown={(e) => e.key === 'Enter' && openLightbox(sample)}
          role="button"
          tabindex="0"
        >
          <div class="image-wrapper">
            {#if sample.url}
              <img
                src={sample.url}
                alt={sample.prompt || `Sample at step ${sample.step}`}
                loading="lazy"
                class="sample-img"
              />
            {:else}
              <div class="placeholder-img">
                <ImageIcon size={32} />
              </div>
            {/if}
            <div class="zoom-overlay">
              <ZoomIn size={24} />
            </div>
            <div class="step-tag">
              Step {sample.step ?? 'N/A'}
            </div>
          </div>
          <div class="sample-info">
            {#if sample.prompt}
              <p class="sample-prompt" title={sample.prompt}>{sample.prompt}</p>
            {/if}
            <div class="sample-meta">
              {#if sample.epoch !== undefined}
                <span>Epoch {sample.epoch}</span>
              {/if}
              {#if sample.seed !== undefined}
                <span>Seed: {sample.seed}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Lightbox Modal -->
{#if selectedSample}
  <div
    class="lightbox-backdrop"
    data-testid="sample-lightbox-modal"
    onclick={closeLightbox}
    role="presentation"
  >
    <div
      class="lightbox-dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') closeLightbox();
      }}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title-id"
    >
      <div class="lightbox-header">
        <div id="lightbox-title-id" class="lightbox-title">
          <span class="badge step">Step {selectedSample.step ?? 'N/A'}</span>
          {#if selectedSample.epoch !== undefined}
            <span class="badge epoch">Epoch {selectedSample.epoch}</span>
          {/if}
        </div>
        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          onclick={closeLightbox}
        >
          <X size={20} />
        </button>
      </div>

      <div class="lightbox-body">
        {#if selectedSample.url}
          <img
            src={selectedSample.url}
            alt={selectedSample.prompt || 'Full resolution sample'}
            class="lightbox-img"
          />
        {:else}
          <div class="lightbox-placeholder">
            <ImageIcon size={64} />
            <span>Image URL unavailable</span>
          </div>
        {/if}
      </div>

      <div class="lightbox-footer">
        {#if selectedSample.prompt}
          <div class="lightbox-field">
            <span class="field-label">Prompt:</span>
            <p class="field-value prompt">{selectedSample.prompt}</p>
          </div>
        {/if}
        <div class="lightbox-meta-row">
          {#if selectedSample.seed !== undefined}
            <span class="meta-item"><strong>Seed:</strong> {selectedSample.seed}</span>
          {/if}
          {#if selectedSample.url}
            <a
              href={selectedSample.url}
              target="_blank"
              rel="noreferrer"
              class="open-link"
            >
              Open Image in New Tab
            </a>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sample-gallery-panel {
    background: var(--panel, #1e1e24);
    border: 1px solid var(--line, #2e2e38);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .gallery-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f0f0f5);
  }

  .sample-count-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    background: var(--control, #15151a);
    color: var(--muted, #8a8a9a);
    border: 1px solid var(--line, #2e2e38);
  }

  .scrubber-container {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 260px;
  }

  .scrubber-label {
    font-size: 0.8125rem;
    color: var(--muted, #8a8a9a);
  }

  .scrubber-value {
    color: var(--accent, #6366f1);
    font-weight: 600;
  }

  .scrubber-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted, #8a8a9a);
  }

  .timeline-scrubber {
    flex: 1;
    accent-color: var(--accent, #6366f1);
    cursor: pointer;
  }

  .reset-scrubber-btn {
    background: var(--control, #262630);
    border: 1px solid var(--line, #2e2e38);
    color: var(--text, #f0f0f5);
    font-size: 0.6875rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .reset-scrubber-btn:hover {
    background: var(--line, #2e2e38);
  }

  .empty-gallery {
    padding: 3rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--muted, #8a8a9a);
    background: var(--panel-raised, #262630);
    border: 1px dashed var(--line, #2e2e38);
    border-radius: 6px;
  }

  .empty-gallery :global(.empty-icon) {
    color: var(--muted, #8a8a9a);
    opacity: 0.5;
  }

  .empty-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text, #f0f0f5);
    margin: 0;
  }

  .empty-subtext {
    font-size: 0.8125rem;
    margin: 0;
  }

  .samples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .sample-card {
    background: var(--panel-raised, #262630);
    border: 1px solid var(--line, #2e2e38);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    display: flex;
    flex-direction: column;
  }

  .sample-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent, #6366f1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .image-wrapper {
    position: relative;
    aspect-ratio: 1;
    background: var(--control, #15151a);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .sample-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-img {
    color: var(--muted, #8a8a9a);
  }

  .zoom-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .sample-card:hover .zoom-overlay {
    opacity: 1;
  }

  .step-tag {
    position: absolute;
    bottom: 0.5rem;
    left: 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    color: #ffffff;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    backdrop-filter: blur(4px);
  }

  .sample-info {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sample-prompt {
    font-size: 0.8125rem;
    color: var(--text, #f0f0f5);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .sample-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--muted, #8a8a9a);
  }

  /* Lightbox Modal */
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .lightbox-dialog {
    background: var(--panel-raised, #262630);
    border: 1px solid var(--line, #2e2e38);
    border-radius: 10px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .lightbox-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--line, #2e2e38);
  }

  .lightbox-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
  }

  .badge.step {
    background: var(--accent, #6366f1);
    color: #ffffff;
  }

  .badge.epoch {
    background: var(--control, #15151a);
    color: var(--text, #f0f0f5);
    border: 1px solid var(--line, #2e2e38);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--muted, #8a8a9a);
    padding: 0.25rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--control, #15151a);
    color: var(--text, #f0f0f5);
  }

  .lightbox-body {
    flex: 1;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 300px;
  }

  .lightbox-img {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }

  .lightbox-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted, #8a8a9a);
  }

  .lightbox-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--line, #2e2e38);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .lightbox-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted, #8a8a9a);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field-value.prompt {
    font-size: 0.875rem;
    color: var(--text, #f0f0f5);
    margin: 0;
    line-height: 1.4;
  }

  .lightbox-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8125rem;
    color: var(--muted, #8a8a9a);
  }

  .open-link {
    color: var(--accent, #6366f1);
    text-decoration: none;
    font-weight: 500;
  }

  .open-link:hover {
    text-decoration: underline;
  }
</style>
