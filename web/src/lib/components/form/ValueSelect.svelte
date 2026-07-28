<script lang="ts" generics="T">
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';

  interface Option<T> {
    value: T;
    label: string;
  }

  let {
    value = $bindable(),
    options = [],
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
    ariaLabel?: string;
    ariaDescribedBy?: string;
    class?: string;
    disabled?: boolean;
    onChange?: (value: T) => void;
    onchange?: (event: Event & { currentTarget: HTMLSelectElement }) => void;
    [key: string]: unknown;
  } = $props();

  const normalizedOptions = $derived(
    options.map((opt, index) => {
      if (typeof opt === 'object' && opt !== null && 'value' in opt && 'label' in opt) {
        return { value: opt.value, label: opt.label, id: String(opt.value), indexStr: String(index) };
      }
      return { value: opt as T, label: String(opt), id: String(opt), indexStr: String(index) };
    })
  );

  const selectedOptionId = $derived.by(() => {
    const found = normalizedOptions.find(
      (opt) => opt.value === value || String(opt.value) === String(value)
    );
    return found ? found.id : (normalizedOptions[0]?.id ?? '');
  });

  function handleChange(event: Event) {
    const target = (event.target || event.currentTarget) as HTMLSelectElement | null;
    const selectedVal = target?.value;
    let selectedOption = normalizedOptions.find(
      (opt) => opt.id === selectedVal || opt.indexStr === selectedVal
    );
    if (!selectedOption) {
      const idx = Number(selectedVal);
      if (!Number.isNaN(idx)) {
        selectedOption = normalizedOptions[idx];
      }
    }

    if (selectedOption !== undefined) {
      value = selectedOption.value;
      onChange?.(selectedOption.value);
    }
    onchange?.(event as any);
  }
</script>

<NativeSelect
  value={selectedOptionId}
  aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
  aria-label={ariaLabel ?? (restProps as Record<string, unknown>)['aria-label'] as string | undefined}
  class={className}
  {disabled}
  onchange={handleChange}
  {...restProps}
>
  {#each normalizedOptions as opt (opt.id)}
    <NativeSelectOption value={opt.id}>
      {opt.label}
    </NativeSelectOption>
  {/each}
</NativeSelect>
