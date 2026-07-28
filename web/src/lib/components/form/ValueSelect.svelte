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

  const parsedOptions = $derived(
    options.map((opt) => {
      if (typeof opt === 'object' && opt !== null && 'value' in opt && 'label' in opt) {
        return { value: (opt as Option<T>).value, label: String((opt as Option<T>).label) };
      }
      return { value: opt as T, label: String(opt) };
    })
  );

  const selectedIndex = $derived.by(() => {
    if (value === undefined || value === null) return -1;
    return parsedOptions.findIndex(
      (opt) => String(opt.value) === String(value)
    );
  });

  const selectedItem = $derived(
    selectedIndex !== -1 ? options[selectedIndex] : null
  );

  const selectedSelectValue = $derived(
    selectedIndex !== -1 ? String(selectedIndex) : (placeholder !== undefined ? '' : (parsedOptions.length > 0 ? '0' : ''))
  );

  function handleChange(event: Event) {
    const target = (event.target || event.currentTarget) as HTMLSelectElement | null;
    const selectedVal = target?.value;

    if (selectedVal !== undefined && selectedVal !== null && selectedVal !== '') {
      const idx = Number(selectedVal);
      if (!Number.isNaN(idx) && idx >= 0 && idx < options.length) {
        const selectedOpt = options[idx];
        let newValue: T;
        if (
          typeof selectedOpt === 'object' &&
          selectedOpt !== null &&
          'value' in selectedOpt
        ) {
          newValue = (selectedOpt as Option<T>).value;
        } else {
          newValue = selectedOpt as T;
        }
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
    <NativeSelectOption value="" disabled selected={selectedItem === null}>
      {placeholder}
    </NativeSelectOption>
  {/if}
  {#each parsedOptions as opt, index (index)}
    <NativeSelectOption value={String(index)}>
      {opt.label}
    </NativeSelectOption>
  {/each}
</NativeSelect>
