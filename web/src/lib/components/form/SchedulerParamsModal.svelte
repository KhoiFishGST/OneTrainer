<script lang="ts">
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';

  let {
    open = $bindable(false),
    values = {},
    onSave = () => {},
  } = $props<{
    open: boolean;
    values?: Record<string, any>;
    onSave?: (updatedValues: Record<string, any>) => void;
  }>();

  let customClassName = $state('');

  $effect(() => {
    if (open) {
      customClassName = values?.custom_learning_rate_scheduler || '';
    }
  });

  function handleApply() {
    onSave({
      custom_learning_rate_scheduler: customClassName,
    });
    open = false;
  }
</script>

<ModalDialog
  bind:open
  title="Configure Custom Scheduler Parameters"
  applyText="Apply Parameters"
  onApply={handleApply}
  onClose={() => (open = false)}
>
  <div class="scheduler-modal-body">
    <div class="field-item">
      <label for="custom-scheduler-class" class="field-label">
        Class Name
      </label>
      <input
        id="custom-scheduler-class"
        type="text"
        class="text-input"
        placeholder="e.g. torch.optim.lr_scheduler.CosineAnnealingLR"
        bind:value={customClassName}
      />
      <span class="field-help">
        Python class module and name for the custom scheduler class in the form of <code>&lt;module&gt;.&lt;class_name&gt;</code>.
      </span>
    </div>
  </div>
</ModalDialog>

<style>
  .scheduler-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .text-input {
    height: 38px;
    padding: 0 0.75rem;
    background-color: var(--input-bg, #0f1419);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    outline: none;
  }

  .text-input:focus {
    border-color: var(--accent, #3b82f6);
  }

  .field-help {
    font-size: 0.75rem;
    color: var(--muted, #94a3b8);

    & code {
      background: var(--panel-raised, rgba(255, 255, 255, 0.05));
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
  }
</style>
