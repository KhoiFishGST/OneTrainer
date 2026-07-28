<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	type Props = WithElementRef<HTMLInputAttributes> & {
		ariaLabel?: string;
		ariaDescribedBy?: string;
		onInput?: (value: string) => void;
		onChange?: (value: string) => void;
		onKeyDown?: (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
		oninput?: (event: Event & { currentTarget: HTMLInputElement }) => void;
		onchange?: (event: Event & { currentTarget: HTMLInputElement }) => void;
		onkeydown?: (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		ariaLabel,
		ariaDescribedBy,
		class: className,
		"data-slot": dataSlot = "input",
		onInput,
		onChange,
		onKeyDown,
		oninput,
		onchange,
		onkeydown,
		...restProps
	}: Props = $props();

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.value;
		onInput?.(event.currentTarget.value);
		oninput?.(event);
	}

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		if (type === "file") {
			files = event.currentTarget.files;
		} else {
			value = event.currentTarget.value;
		}
		onChange?.(event.currentTarget.value);
		onchange?.(event);
	}

	function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		onKeyDown?.(event);
		onkeydown?.(event);
	}

	export function focus() {
		ref?.focus();
	}
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		type="file"
		oninput={handleInput}
		onchange={handleChange}
		onkeydown={handleKeyDown}
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		{type}
		bind:value
		aria-describedby={ariaDescribedBy ?? (restProps as Record<string, unknown>)['aria-describedby'] as string | undefined}
		aria-label={ariaLabel ?? (restProps as Record<string, unknown>)['aria-label'] as string | undefined}
		oninput={handleInput}
		onchange={handleChange}
		onkeydown={handleKeyDown}
		{...restProps}
	/>
{/if}
