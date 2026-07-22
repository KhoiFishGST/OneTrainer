<script lang="ts">
  import ConsoleView from '$lib/components/console/ConsoleView.svelte';
  import { consoleStore } from '$lib/events/console-store.svelte';
</script>

<svelte:head>
  <title>OneTrainer - Console</title>
</svelte:head>

<div class="console-page">
  <ConsoleView store={consoleStore} />
</div>

<style>
  .console-page {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
