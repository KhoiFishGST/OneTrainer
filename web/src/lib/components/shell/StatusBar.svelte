<script lang="ts">
  import {
    Play,
    Pause,
    Square,
    Sparkles,
    Archive,
    RotateCcw,
    RefreshCw,
    AlertTriangle,
  } from 'lucide-svelte';
  import { getRouteContext } from '../../config/context';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';
  import { trainingStore } from '../../events/training-store';
  import { api } from '../../api/client';

  let {
    workspace: workspaceProp = null,
  } = $props<{
    workspace?: ConfigWorkspace | null;
  }>();

  let ctx: any = null;
  try {
    ctx = getRouteContext();
  } catch {
    // context not provided in isolated unit test
  }

  const workspace = $derived(workspaceProp ?? ctx?.workspace);
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
    {#if workspace}
      {#if workspace.state === 'failed' || workspace.state === 'unsaved'}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.retry()}
        >
          <RotateCcw size={16} />
          <span>Retry</span>
        </button>
      {/if}

      {#if workspace.state === 'conflict'}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.reloadServer(true)}
        >
          <RefreshCw size={16} />
          <span>Reload</span>
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={() => workspace.overwriteServer()}
        >
          <AlertTriangle size={16} />
          <span>Overwrite</span>
        </button>
      {/if}
    {/if}

    <div class="training-action-buttons">
      {#if trainingState === 'IDLE' || trainingState === 'COMPLETED' || trainingState === 'FAILED'}
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleStartTraining}
        >
          <Play size={16} />
          <span>Start Training</span>
        </button>
      {:else if trainingState === 'TRAINING'}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handlePauseTraining}
        >
          <Pause size={16} />
          <span>Pause</span>
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleSample}
        >
          <Sparkles size={16} />
          <span>Sample</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleBackup}
        >
          <Archive size={16} />
          <span>Backup</span>
        </button>
      {:else if trainingState === 'PAUSED'}
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleResumeTraining}
        >
          <Play size={16} />
          <span>Resume</span>
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleSample}
        >
          <Sparkles size={16} />
          <span>Sample</span>
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleBackup}
        >
          <Archive size={16} />
          <span>Backup</span>
        </button>
      {:else if trainingState === 'STOPPING'}
        <button
          type="button"
          class="btn btn-danger"
          disabled
        >
          <Square size={16} />
          <span>Stop</span>
        </button>
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

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
    user-select: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: var(--accent, #3b82f6);
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(1px);
  }

  .btn-secondary {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--line, #2d3741);
    color: #ffffff;
    border-color: var(--muted, #475569);
  }

  .btn-secondary:active:not(:disabled) {
    transform: translateY(1px);
  }

  .btn-danger {
    background-color: var(--danger, #ef4444);
    color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #dc2626;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
  }

  .btn-danger:active:not(:disabled) {
    transform: translateY(1px);
  }
</style>
