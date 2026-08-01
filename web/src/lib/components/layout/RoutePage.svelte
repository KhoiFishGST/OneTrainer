<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    class: className = '',
  }: {
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`route-page ${className}`}>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  :where(.route-page) {
    width: 100%;
    max-width: var(--width-page);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
    /*
      RoutePage is mounted fresh on every route change, so this fires by itself
      -- no {#key} block, no forced remount, no onNavigate hook.

      Enter-only, deliberately. An exit animation would put 70ms between the
      click and the new page, which is exactly the latency this motion scale
      exists to avoid. The outgoing page is removed immediately.

      This doubles as the skeleton-to-content crossfade: the schema-form pages
      render FormPageSkeleton outside RoutePage and swap to RoutePage when the
      workspace resolves, which mounts this element and runs this animation.
    */
    animation: route-page-in var(--motion-duration-enter) var(--motion-ease-enter);
  }

  @keyframes route-page-in {
    from {
      opacity: 0;
      transform: translateY(var(--motion-travel));
    }
  }
</style>
