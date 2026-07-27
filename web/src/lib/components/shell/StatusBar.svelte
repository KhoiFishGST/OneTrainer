<script lang="ts">
  import {
    Play,
    Pause,
    Square,
    Sparkles,
    Archive,
  } from 'lucide-svelte';
  import Button from '../ui/Button.svelte';
  import { trainingStore } from '../../events/training-store';
  import { api } from '../../api/client';

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');

  async function handleStartTraining() {
    try {
      await api.startTraining();
    } catch (err) {
      console.error('Failed to start training', err);
    }
  }

  async function handlePauseTraining() {
    try {
      await api.pauseTraining();
    } catch (err) {
      console.error('Failed to pause training', err);
    }
  }

  async function handleResumeTraining() {
    try {
      await api.resumeTraining();
    } catch (err) {
      console.error('Failed to resume training', err);
    }
  }

  async function handleStopTraining() {
    try {
      await api.stopTraining();
    } catch (err) {
      console.error('Failed to stop training', err);
    }
  }

  async function handleSample() {
    try {
      await api.requestSample();
    } catch (err) {
      console.error('Failed to request sample', err);
    }
  }

  async function handleBackup() {
    try {
      await api.requestBackup();
    } catch (err) {
      console.error('Failed to request backup', err);
    }
  }
</script>

<footer class="status-bar safe-area-padding">
  <div class="status-bar-right">
    <div class="training-action-buttons">
      {#if trainingState === 'IDLE' || trainingState === 'COMPLETED' || trainingState === 'FAILED'}
        <Button
          variant="primary"
          class="btn btn-primary"
          onclick={handleStartTraining}
        >
          <Play size={16} />
          <span>Start Training</span>
        </Button>
      {:else if trainingState === 'TRAINING'}
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={handlePauseTraining}
        >
          <Pause size={16} />
          <span>Pause</span>
        </Button>
        <Button
          variant="danger"
          class="btn btn-danger"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={handleSample}
        >
          <Sparkles size={16} />
          <span>Sample</span>
        </Button>
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={handleBackup}
        >
          <Archive size={16} />
          <span>Backup</span>
        </Button>
      {:else if trainingState === 'PAUSED'}
        <Button
          variant="primary"
          class="btn btn-primary"
          onclick={handleResumeTraining}
        >
          <Play size={16} />
          <span>Resume</span>
        </Button>
        <Button
          variant="danger"
          class="btn btn-danger"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={handleSample}
        >
          <Sparkles size={16} />
          <span>Sample</span>
        </Button>
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={handleBackup}
        >
          <Archive size={16} />
          <span>Backup</span>
        </Button>
      {:else if trainingState === 'STOPPING'}
        <Button
          variant="danger"
          class="btn btn-danger"
          disabled
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
      {/if}
    </div>
  </div>
</footer>

<style>
  .status-bar {
    height: var(--status-height, 52px);
    background-color: var(--panel);
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 16px;
    font-size: 0.875rem;
    z-index: 50;
  }

  .status-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .training-action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 4px;
  }

  .training-action-buttons :global(.btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 0;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
    user-select: none;
  }

  .training-action-buttons :global(.btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .training-action-buttons :global(.btn-primary) {
    background-color: var(--accent, #3b82f6);
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .training-action-buttons :global(.btn-primary:hover:not(:disabled)) {
    background-color: #2563eb;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
  }

  .training-action-buttons :global(.btn-primary:active:not(:disabled)) {
    transform: translateY(1px);
  }

  .training-action-buttons :global(.btn-secondary) {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .training-action-buttons :global(.btn-secondary:hover:not(:disabled)) {
    background-color: var(--line, #2d3741);
    color: #ffffff;
    border-color: var(--muted, #475569);
  }

  .training-action-buttons :global(.btn-secondary:active:not(:disabled)) {
    transform: translateY(1px);
  }

  .training-action-buttons :global(.btn-danger) {
    background-color: var(--danger, #ef4444);
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .training-action-buttons :global(.btn-danger:hover:not(:disabled)) {
    background-color: #dc2626;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
  }

  .training-action-buttons :global(.btn-danger:active:not(:disabled)) {
    transform: translateY(1px);
  }
</style>
