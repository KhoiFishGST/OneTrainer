<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	type Props = WithoutChildren<WithElementRef<HTMLTextareaAttributes>> & {
		onInput?: (value: string) => void;
		onChange?: (value: string) => void;
		onBlur?: (value: string, event: FocusEvent & { currentTarget: HTMLTextAreaElement }) => void;
		oninput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void;
		onchange?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void;
		onblur?: (event: FocusEvent & { currentTarget: HTMLTextAreaElement }) => void;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		onInput,
		onChange,
		onBlur,
		oninput,
		onchange,
		onblur,
		...restProps
	}: Props = $props();

	function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		value = event.currentTarget.value;
		onInput?.(event.currentTarget.value);
		oninput?.(event);
	}

	function handleChange(event: Event & { currentTarget: HTMLTextAreaElement }) {
		value = event.currentTarget.value;
		onChange?.(event.currentTarget.value);
		onchange?.(event);
	}

	function handleBlur(event: FocusEvent & { currentTarget: HTMLTextAreaElement }) {
		onBlur?.(event.currentTarget.value, event);
		onblur?.(event);
	}
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		"border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-[44px]",
		className
	)}
	bind:value
	oninput={handleInput}
	onchange={handleChange}
	onblur={handleBlur}
	{...restProps}
></textarea>
