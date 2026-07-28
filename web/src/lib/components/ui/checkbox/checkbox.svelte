<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from "bits-ui";
	import CheckIcon from "@lucide/svelte/icons/check";
	import MinusIcon from "@lucide/svelte/icons/minus";
	import { cn, type WithElementRef } from "$lib/utils.js";

	type Props = Omit<WithElementRef<CheckboxPrimitive.RootProps>, 'value'> & {
		value?: any;
		ariaLabel?: string;
		ariaDescribedBy?: string;
		onChange?: (checked: boolean) => void;
	};

	let {
		ref = $bindable(null),
		checked = $bindable<boolean | undefined>(undefined),
		value = $bindable<any>(undefined),
		indeterminate = $bindable(false),
		ariaLabel,
		ariaDescribedBy,
		class: className,
		"data-slot": dataSlot = "checkbox",
		onChange,
		onCheckedChange,
		...restProps
	}: Props = $props();

	const currentChecked = $derived.by(() => {
		if (typeof checked === 'boolean') return checked;
		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') return value === 'true';
		return false;
	});

	function handleCheckedChange(newVal: boolean) {
		checked = newVal;
		value = newVal;
		onChange?.(newVal);
		(onCheckedChange as any)?.(newVal);
	}
</script>

<CheckboxPrimitive.Root
	bind:ref
	aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
	aria-label={ariaLabel ?? ((restProps as Record<string, unknown>)['aria-label'] as string | undefined) ?? (restProps.id ? String(restProps.id).replace(/_/g, ' ') : "Toggle")}
	data-slot={dataSlot}
	class={cn(
		"border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 peer shadow-xs size-4 shrink-0 rounded-[4px] border transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']",
		className
	)}
	checked={currentChecked}
	onCheckedChange={handleCheckedChange}
	bind:indeterminate
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<span class="flex items-center justify-center text-current">
			{#if indeterminate}
				<MinusIcon class="size-3.5" />
			{:else if checked}
				<CheckIcon class="size-3.5" />
			{/if}
		</span>
	{/snippet}
</CheckboxPrimitive.Root>
