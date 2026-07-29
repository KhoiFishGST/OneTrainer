<script lang="ts" module>
	export type Side = "top" | "right" | "bottom" | "left";
</script>

<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";
	import SheetPortal from "./sheet-portal.svelte";
	import SheetOverlay from "./sheet-overlay.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import XIcon from '@lucide/svelte/icons/x';
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		side = "right",
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SheetPortal>>;
		side?: Side;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<SheetPortal {...portalProps}>
	<SheetOverlay />
	<!--
		LOCAL MODIFICATION: upstream's `animate-in` / `fade-in-0` /
		`slide-in-from-*` utilities are removed from the class string below.
		They need the `tw-animate-css` plugin, which this project does not
		import, so every one of them compiled to nothing -- the sheet had no
		animation at all and the classes only suggested otherwise. The slide is
		hand-written in `src/app.css` against the `data-side` / `data-state`
		attributes this component and bits-ui already set. Re-running
		`shadcn-svelte add sheet` will put the dead classes back; it will not
		break the animation, but it will mislead the next reader.
	-->
	<SheetPrimitive.Content
		bind:ref
		data-slot="sheet-content"
		data-side={side}
		class={cn(
			"bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<SheetPrimitive.Close data-slot="sheet-close">
				{#snippet child({ props })}
					<Button variant="ghost" class="absolute top-3 right-3" size="icon-sm" {...props}>
						<XIcon  />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</SheetPrimitive.Close>
		{/if}
	</SheetPrimitive.Content>
</SheetPortal>
