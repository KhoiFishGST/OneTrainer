<script lang="ts" generics="T">
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';

  interface Option<T> {
    value: T;
    label: string;
  }

  let {
    value = $bindable(),
    options = [],
    placeholder,
    ariaLabel,
    ariaDescribedBy,
    class: className,
    disabled = false,
    onChange,
    onchange,
    ...restProps
  }: {
    value?: T;
    options: Array<Option<T> | T>;
    placeholder?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    class?: string;
    disabled?: boolean;
    onChange?: (value: T) => void;
    onchange?: (event: Event & { currentTarget: HTMLSelectElement }) => void;
    [key: string]: unknown;
  } = $props();

  function getOptValue(opt: unknown): T {
    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
      return (opt as Option<T>).value;
    }
    return opt as T;
  }

  function getOptLabel(opt: unknown): string {
    if (typeof opt === 'object' && opt !== null && 'label' in opt) {
      return String((opt as Option<T>).label);
    }
    return String(opt);
  }

  const parsedOptions = $derived(
    options.map((opt, index) => ({
      index,
      optionValue: String(index),
      value: getOptValue(opt),
      label: getOptLabel(opt)
    }))
  );

  const selectedIndex = $derived.by(() => {
    if (value === undefined || value === null) return -1;
    const strictIdx = options.findIndex((opt) => getOptValue(opt) === value);
    if (strictIdx !== -1) return strictIdx;

    const targetStr = String(value);
    return options.findIndex(
      (opt) => String(getOptValue(opt)) === targetStr
    );
  });

  const hasNoSelection = $derived(selectedIndex === -1);

  const isUnknown = $derived(
    hasNoSelection && value !== undefined && value !== null && value !== ''
  );

  const isEmptyWithoutPlaceholder = $derived(hasNoSelection && !isUnknown && !placeholder);

  const selectedSelectValue = $derived(
    !hasNoSelection
      ? String(selectedIndex)
      : isUnknown || isEmptyWithoutPlaceholder
        ? '__unknown__'
        : ''
  );

  function handleChange(event: Event) {
    const target = (event.currentTarget || event.target) as HTMLSelectElement | null;
    const selectedVal = target?.value;

    if (selectedVal !== undefined && selectedVal !== null && selectedVal !== '' && selectedVal !== '__unknown__') {
      const idx = Number(selectedVal);
      if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) {
        const selectedOpt = options[idx];
        const newValue = getOptValue(selectedOpt);
        value = newValue;
        onChange?.(newValue);
      }
    }
    onchange?.(event as Event & { currentTarget: HTMLSelectElement });
  }
</script>

<NativeSelect
  value={selectedSelectValue}
  aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
  aria-label={ariaLabel ?? (restProps as Record<string, unknown>)['aria-label'] as string | undefined}
  class={className}
  {disabled}
  onchange={handleChange}
  {...restProps}
>
  {#if isUnknown || isEmptyWithoutPlaceholder}
    <NativeSelectOption value="__unknown__" disabled selected={true}>
      {isUnknown ? `Unknown: ${String(value)}` : 'Select...'}
    </NativeSelectOption>
  {/if}
  {#if placeholder}
    <NativeSelectOption value="" disabled selected={selectedIndex === -1 && !isUnknown}>
      {placeholder}
    </NativeSelectOption>
  {/if}
  {#each parsedOptions as opt (opt.index)}
    <NativeSelectOption value={opt.optionValue} selected={selectedIndex === opt.index}>
      {opt.label}
    </NativeSelectOption>
  {/each}
</NativeSelect>
