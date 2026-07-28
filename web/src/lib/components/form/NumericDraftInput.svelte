<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Input from '$lib/components/ui/input/input.svelte';

  type InputProps = ComponentProps<typeof Input>;

  let {
    value = $bindable<number | string | null | undefined>(),
    type = 'text',
    inputmode = 'decimal',
    min,
    max,
    step,
    ariaLabel,
    ariaDescribedBy,
    class: className,
    onchange,
    oninput,
    onChange,
    onInput,
    ...restProps
  }: Omit<InputProps, 'value' | 'type' | 'onChange' | 'onInput'> & {
    value?: number | string | null | undefined;
    type?: InputProps['type'];
    inputmode?: string;
    onChange?: (value: string) => void;
    onInput?: (value: string) => void;
  } = $props();

  let draftValue = $state('');
  let isEditing = $state(false);

  $effect(() => {
    if (!isEditing) {
      draftValue = value === null || value === undefined ? '' : String(value);
    }
  });

  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    isEditing = true;
    draftValue = event.currentTarget.value;
    value = draftValue;
    onInput?.(draftValue);
    (oninput as any)?.(event);
  }

  function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
    draftValue = event.currentTarget.value;
    value = draftValue;
    onChange?.(draftValue);
    isEditing = false;
    (onchange as any)?.(event);
  }
</script>

<Input
  {type}
  inputmode={inputmode}
  value={draftValue}
  {min}
  {max}
  {step}
  aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
  aria-label={ariaLabel ?? (restProps as Record<string, unknown>)['aria-label'] as string | undefined}
  class={className}
  oninput={handleInput}
  onchange={handleChange}
  {...restProps}
/>
