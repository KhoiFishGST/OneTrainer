<script lang="ts" module>
  export type SubNavItem = { id: string; label: string };
</script>

<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import Select from '$lib/components/form/ValueSelect.svelte';

  let { items = [], value, onChange, label } = $props<{
    items?: SubNavItem[];
    value: string;
    onChange: (id: string) => void;
    label: string;
  }>();

  const options = $derived(items.map((item: SubNavItem) => ({ value: item.id, label: item.label })));
</script>

<!--
  Both variants render and CSS picks one, so first paint is correct before
  hydration. A tab strip cannot fit a phone without horizontal scrolling; the
  native select gets the platform picker instead.
-->
<div class="hidden md:block">
  <Tabs.Root {value} onValueChange={(val) => { if (val) onChange(val); }}>
    <Tabs.List variant="line">
      {#each items as item (item.id)}
        <Tabs.Trigger value={item.id}>{item.label}</Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>
</div>

<div class="md:hidden">
  <Select ariaLabel={label} {value} {options} onChange={(next) => onChange(next as string)} />
</div>
