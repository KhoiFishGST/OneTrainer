<script lang="ts">
  import { setRouteContext } from '$lib/config/context';
  import GalleryPage from './+page.svelte';

  let { workspace = null } = $props<{ workspace?: any }>();

  setRouteContext({ workspace, schema: {} as any });
</script>

<GalleryPage />
