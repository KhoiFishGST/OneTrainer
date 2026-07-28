<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

	type Props = WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
		size?: "sm" | "default";
		value?: boolean;
		ariaDescribedBy?: string;
		ariaLabel?: string;
		onChange?: (checked: boolean) => void;
	};

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		value,
		ariaDescribedBy,
		ariaLabel,
		onChange,
		onCheckedChange,
		size = "default",
		...restProps
	}: Props = $props();

	let currentChecked = $derived.by(() => (value !== undefined ? value : checked));

	function handleCheckedChange(val: boolean) {
		checked = val;
		onCheckedChange?.(val);
		onChange?.(val);
	}
</script>

<SwitchPrimitive.Root
	bind:ref
	checked={currentChecked}
	onCheckedChange={handleCheckedChange}
	aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
	aria-label={ariaLabel ?? (restProps as Record<string, unknown>)['aria-label'] as string | undefined}
	data-slot="switch"
	data-size={size}
	class={cn(
		"data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-full border border-transparent focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class="bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block ring-0 transition-transform rtl:data-[state=checked]:translate-x-[calc(-100%)]"
	/>
</SwitchPrimitive.Root>
