<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';

  let {
    id,
    name,
    value = '',
    options = [],
    placeholder = '',
    disabled = false,
    required = false,
    class: className = '',
    ariaDescribedBy,
    ariaLabel,
    onChange,
    onBlur,
    onKeyDown,
  }: {
    id?: string;
    name?: string;
    value?: any;
    options?: Array<{ value: any; label: string } | string>;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    class?: string;
    ariaDescribedBy?: string;
    ariaLabel?: string;
    onChange?: (val: any) => void;
    onBlur?: (event: FocusEvent) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
  } = $props();

  let isOpen = $state(false);
  let opensUpward = $state(false);
  let triggerBtn = $state<HTMLButtonElement | null>(null);

  const parsedOptions = $derived(
    options.map((opt) =>
      typeof opt === 'object' && opt !== null
        ? { value: opt.value, label: opt.label }
        : { value: opt, label: String(opt) }
    )
  );

  const selectedOption = $derived(
    parsedOptions.find((opt) => String(opt.value) === String(value))
  );

  function checkDirection() {
    if (!triggerBtn) return;
    const rect = triggerBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popoverHeight = Math.min(260, parsedOptions.length * 36 + 12);

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      opensUpward = true;
    } else {
      opensUpward = false;
    }
  }

  function toggleOpen(e: MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      checkDirection();
      isOpen = true;
    } else {
      isOpen = false;
    }
  }

  function handleSelect(val: any) {
    isOpen = false;
    if (onChange) {
      onChange(val);
    }
  }

  function handleNativeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    handleSelect(val);
  }

  function closePopover() {
    isOpen = false;
  }
</script>

<svelte:window onclick={closePopover} onresize={() => { if (isOpen) checkDirection(); }} />

<div class={`custom-select-wrapper ${className}`} class:is-disabled={disabled}>
  <button
    bind:this={triggerBtn}
    type="button"
    id={id ? `${id}-trigger` : undefined}
    class="select-trigger"
    {disabled}
    aria-expanded={isOpen}
    aria-describedby={ariaDescribedBy}
    onclick={toggleOpen}
  >
    <span class="select-trigger-label" class:is-placeholder={!selectedOption}>
      {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
    </span>
    <span class="chevron-icon-wrapper" class:is-open={isOpen}>
      <ChevronDown size={14} />
    </span>
  </button>

  {#if isOpen && !disabled}
    <div
      class="select-popover"
      class:opens-upward={opensUpward}
      role="listbox"
    >
      {#if placeholder && !parsedOptions.some((o) => String(o.value) === '')}
        <button
          type="button"
          class="select-popover-option is-placeholder-option"
          disabled
          role="option"
          aria-selected={false}
        >
          {placeholder}
        </button>
      {/if}
      {#each parsedOptions as opt}
        <button
          type="button"
          class="select-popover-option"
          class:is-active={String(opt.value) === String(value)}
          role="option"
          aria-selected={String(opt.value) === String(value)}
          onclick={(e) => {
            e.stopPropagation();
            handleSelect(opt.value);
          }}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}

  <select
    {id}
    {name}
    value={value ?? ''}
    {disabled}
    {required}
    aria-describedby={ariaDescribedBy}
    aria-label={ariaLabel}
    onchange={handleNativeChange}
    onblur={onBlur}
    onkeydown={onKeyDown}
    class="sr-only-select"
  >
    {#if placeholder}
      <option value="" disabled selected={!value}>{placeholder}</option>
    {/if}
    {#each parsedOptions as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .custom-select-wrapper {
    position: relative;
    display: inline-flex;
    width: 100%;
    min-width: 140px;
  }

  .select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    min-height: 36px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .select-trigger:hover:not(:disabled) {
    border-color: var(--color-primary, var(--accent, #3b82f6));
  }

  .select-trigger:focus-visible {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .select-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .select-trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-trigger-label.is-placeholder {
    color: var(--color-text-muted, var(--muted, #8995a1));
  }

  .chevron-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--color-text-muted, var(--muted, #8995a1));
    transition: transform 0.15s ease;
  }

  .chevron-icon-wrapper.is-open {
    transform: rotate(180deg);
  }

  .select-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    width: 100%;
    min-width: max-content;
    max-height: 260px;
    overflow-y: auto;
    background-color: var(--color-bg-secondary, var(--panel-raised, #1d242c));
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 250;
    display: flex;
    flex-direction: column;
    padding: 4px;
    gap: 2px;
    animation: fadeInDown 0.12s ease-out;
  }

  .select-popover.opens-upward {
    top: auto;
    bottom: calc(100% + 6px);
    animation: fadeInUp 0.12s ease-out;
  }

  .select-popover-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    font-size: 0.875rem;
    color: var(--color-text, var(--text, #e6ebef));
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .select-popover-option:hover:not(:disabled) {
    background-color: var(--accent-soft, #1e293b);
    color: var(--color-primary, var(--accent, #3b82f6));
  }

  .select-popover-option.is-active {
    background-color: var(--color-primary, var(--accent, #3b82f6));
    color: #ffffff;
    font-weight: 600;
  }

  .select-popover-option.is-placeholder-option {
    color: var(--color-text-muted, var(--muted, #8995a1));
    cursor: default;
    font-style: italic;
  }

  .sr-only-select {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
