<script lang="ts">
  import {
    Play,
    Pause,
    Square,
    Sparkles,
    Archive,
    MoreHorizontal,
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
  import { trainingStore } from '../../events/training-store';
  import { api } from '../../api/client';

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');
  const mobile = $derived(isMobile.current);

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

<footer class="min-h-[52px] h-auto bg-card border-t border-border flex items-center justify-end px-4 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] text-sm z-50 safe-area-padding">
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-2 ml-1 flex-wrap">
      {#if trainingState === 'IDLE' || trainingState === 'COMPLETED' || trainingState === 'FAILED'}
        <Button
          variant="default"
          size="sm"
          class="gap-1.5"
          onclick={handleStartTraining}
        >
          <Play size={16} />
          <span>Start Training</span>
        </Button>
      {:else if trainingState === 'TRAINING'}
        <Button
          variant="secondary"
          size="sm"
          class="gap-1.5"
          onclick={handlePauseTraining}
        >
          <Pause size={16} />
          <span>Pause</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          class="gap-1.5"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
        {#if !mobile}
          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5"
            onclick={handleSample}
          >
            <Sparkles size={16} />
            <span>Sample</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5"
            onclick={handleBackup}
          >
            <Archive size={16} />
            <span>Backup</span>
          </Button>
        {:else}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="secondary"
                  size="sm"
                  class="gap-1.5"
                  aria-label="Actions"
                >
                  <MoreHorizontal size={16} />
                  <span>Actions</span>
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onclick={handleSample} class="phone-action-item">
                <Sparkles size={16} class="mr-2" />
                <span>Sample</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onclick={handleBackup} class="phone-action-item">
                <Archive size={16} class="mr-2" />
                <span>Backup</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      {:else if trainingState === 'PAUSED'}
        <Button
          variant="default"
          size="sm"
          class="gap-1.5"
          onclick={handleResumeTraining}
        >
          <Play size={16} />
          <span>Resume</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          class="gap-1.5"
          onclick={handleStopTraining}
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
        {#if !mobile}
          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5"
            onclick={handleSample}
          >
            <Sparkles size={16} />
            <span>Sample</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5"
            onclick={handleBackup}
          >
            <Archive size={16} />
            <span>Backup</span>
          </Button>
        {:else}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="secondary"
                  size="sm"
                  class="gap-1.5"
                  aria-label="Actions"
                >
                  <MoreHorizontal size={16} />
                  <span>Actions</span>
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onclick={handleSample} class="phone-action-item">
                <Sparkles size={16} class="mr-2" />
                <span>Sample</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onclick={handleBackup} class="phone-action-item">
                <Archive size={16} class="mr-2" />
                <span>Backup</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      {:else if trainingState === 'STOPPING'}
        <Button
          variant="destructive"
          size="sm"
          class="gap-1.5"
          disabled
        >
          <Square size={16} />
          <span>Stop</span>
        </Button>
      {/if}
    </div>
  </div>
</footer>
