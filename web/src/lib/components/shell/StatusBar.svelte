<script lang="ts">
  import { createHealthQuery } from '../../api/queries';

  let {
    connected: connectedProp,
    onToggleConsole,
  }: {
    connected?: boolean;
    onToggleConsole?: () => void;
  } = $props();

  const healthQuery = createHealthQuery();

  const isConnected = $derived(
    connectedProp ?? $healthQuery.isSuccess
  );
</script>

<footer class="status-bar safe-area-padding">
  <div class="server-status">
    <span class="status-indicator" class:connected={isConnected}></span>
    <span class="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
    {#if onToggleConsole}
      <button
        type="button"
        class="console-toggle-btn"
        onclick={onToggleConsole}
        title="Toggle Console Drawer"
      >
        Console
      </button>
    {/if}
  </div>

  <div class="action-buttons">
    <button
      type="button"
      class="action-btn"
      aria-disabled="true"
      disabled
      title="Unavailable in Phase A"
    >
      Start
    </button>
    <button
      type="button"
      class="action-btn"
      aria-disabled="true"
      disabled
      title="Unavailable in Phase A"
    >
      Sample
    </button>
    <button
      type="button"
      class="action-btn"
      aria-disabled="true"
      disabled
      title="Unavailable in Phase A"
    >
      Backup
    </button>
    <button
      type="button"
      class="action-btn"
      aria-disabled="true"
      disabled
      title="Unavailable in Phase A"
    >
      Save
    </button>
  </div>
</footer>

<style>
  .status-bar {
    height: var(--status-height, 52px);
    background-color: var(--panel);
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    font-size: 0.875rem;
    z-index: 50;
  }

  .server-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--danger);
  }

  .status-indicator.connected {
    background-color: var(--success);
  }

  .status-text {
    color: var(--muted);
  }

  .console-toggle-btn {
    background-color: var(--control, #21262d);
    color: var(--text, #c9d1d9);
    border: 1px solid var(--line, #30363d);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: 8px;
  }

  .console-toggle-btn:hover {
    background-color: var(--line, #30363d);
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    background-color: var(--control);
    color: var(--muted);
    border: 1px solid var(--line);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
