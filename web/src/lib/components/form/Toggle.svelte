<script lang="ts">
  let {
    id,
    value = false,
    disabled = false,
    ariaDescribedBy,
    onChange,
  }: {
    id: string;
    value?: boolean;
    disabled?: boolean;
    ariaDescribedBy?: string;
    onChange: (val: boolean) => void;
  } = $props();

  function handleInput(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    onChange(checked);
  }
</script>

<input
  type="checkbox"
  {id}
  checked={!!value}
  {disabled}
  aria-describedby={ariaDescribedBy}
  onchange={handleInput}
  class="toggle-input"
/>

<style>
  .toggle-input {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
    accent-color: var(--color-primary, var(--accent, #dd773b));
    margin: 0;
    vertical-align: middle;
  }
</style>
