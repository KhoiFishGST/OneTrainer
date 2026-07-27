<script lang="ts">
  import { Plus } from 'lucide-svelte';
  import Button from './Button.svelte';

  let {
    label = 'Add Item',
    disabled = false,
    onClick,
  }: {
    label?: string;
    disabled?: boolean;
    onClick?: () => void;
  } = $props();
</script>

<Button
  variant="ghost"
  class="add-card"
  {disabled}
  onclick={onClick}
>
  <div class="add-icon-wrapper">
    <Plus size={32} />
  </div>
  <span class="add-label">{label}</span>
</Button>

<style>
  :global(.add-card) {
    min-height: 220px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 2px dashed var(--line, #2d3741);
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    box-sizing: border-box;
    padding: 1.5rem;
  }

  :global(.add-card:hover:not(:disabled)) {
    border-color: var(--accent, #3b82f6);
    background: rgba(59, 130, 246, 0.05);
    transform: translateY(-2px);
  }

  :global(.add-card:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-icon-wrapper {
    color: var(--accent, #3b82f6);
  }

  .add-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }
</style>
