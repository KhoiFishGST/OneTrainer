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

  function getOptionValueString(opt: unknown, index: number): string {
    const optVal = getOptValue(opt);
    const str = String(optVal ?? '');
    if (str === '[object Object]' || str === '') {
      return String(index);
    }
    return str;
  }

  const parsedOptions = $derived(
    options.map((opt, index) => ({
      value: getOptValue(opt),
      label: getOptLabel(opt),
      optionValue: getOptionValueString(opt, index)
    }))
  );

  const selectedIndex = $derived.by(() => {
    if (value === undefined || value === null) return -1;
    const targetStr = String(value);
    return options.findIndex(
      (opt) => String(getOptValue(opt)) === targetStr
    );
  });

  const selectedSelectValue = $derived(
    selectedIndex !== -1
      ? getOptionValueString(options[selectedIndex], selectedIndex)
      : placeholder !== undefined
        ? ''
        : options.length > 0
          ? getOptionValueString(options[0], 0)
          : ''
  );

  function handleChange(event: Event) {
    const target = (event.currentTarget || event.target) as HTMLSelectElement | null;
    const selectedVal = target?.value;

    if (selectedVal !== undefined && selectedVal !== null && selectedVal !== '') {
      let selectedOpt = options.find(
        (o) => String(getOptValue(o)) === selectedVal
      );

      if (selectedOpt === undefined) {
        const idx = Number(selectedVal);
        if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) {
          selectedOpt = options[idx];
        }
      }

      if (selectedOpt !== undefined) {
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
  {#if placeholder}
    <NativeSelectOption value="" disabled selected={selectedIndex === -1}>
      {placeholder}
    </NativeSelectOption>
  {/if}
  {#each parsedOptions as opt, index (index)}
    <NativeSelectOption value={opt.optionValue}>
      {opt.label}
    </NativeSelectOption>
  {/each}
</NativeSelect>

