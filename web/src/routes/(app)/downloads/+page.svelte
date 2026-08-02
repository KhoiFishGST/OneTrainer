<script lang="ts">
  import { createDownloadRunsQuery, createDownloadRunQuery } from '$lib/api/queries';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import { Button } from '$lib/components/ui/button';
  import { api } from '$lib/api/client';
  import { toast } from 'svelte-sonner';

  const runsQuery = createDownloadRunsQuery();

  let userSelectedKey = $state<string | null>(null);

  const availableRuns = $derived($runsQuery.data?.runs ?? []);

  const selectedRunKey = $derived.by(() => {
    if (userSelectedKey && availableRuns.some((r) => r.key === userSelectedKey)) {
      return userSelectedKey;
    }
    return availableRuns.length > 0 ? availableRuns[0].key : null;
  });

  const runQuery = $derived(createDownloadRunQuery(selectedRunKey));
  const checkpoints = $derived($runQuery.data?.checkpoints ?? []);

  function formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }

  function downloadHref(runKey: string, c: { filename: string; is_directory: boolean }): string {
    const run = encodeURIComponent(runKey);
    const name = encodeURIComponent(c.filename);
    return c.is_directory
      ? `/api/downloads/runs/${run}/archives/${name}.zip`
      : `/api/downloads/runs/${run}/files/${name}`;
  }

  async function remove(filename: string, linked: boolean) {
    if (!selectedRunKey) return;

    // Deleting a link frees nothing while the original survives; deleting a
    // copy frees the bytes now. Say which one this is.
    const message = linked
      ? `Remove ${filename} from Downloads? The original OneTrainer file is kept, so no disk space is freed.`
      : `Delete ${filename}? This is the web UI's own copy and the space will be freed.`;
    if (!confirm(message)) return;

    try {
      await api.deleteCheckpoint(selectedRunKey, filename);
      toast.success(`Removed ${filename}`);
      await $runQuery.refetch();
    } catch (err: any) {
      toast.error(err?.detail?.message || err?.message || 'Could not remove this checkpoint');
    }
  }
</script>

<RoutePage>
  <PageHeader title="Downloads">
    {#snippet actions()}
      {#if availableRuns.length > 0}
        <Select
          ariaLabel="Run"
          value={selectedRunKey ?? ''}
          options={availableRuns.map((r) => ({ value: r.key, label: r.key }))}
          onChange={(value: string) => (userSelectedKey = value)}
        />
      {/if}
    {/snippet}
  </PageHeader>

  {#if availableRuns.length === 0}
    <p class="text-muted-foreground">
      No checkpoints yet. They appear here after a run saves a model or finishes.
    </p>
  {:else}
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-muted-foreground">
          <th class="py-2">File</th>
          <th>Kind</th>
          <th>Format</th>
          <th>Size</th>
          <th>Storage</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each checkpoints as c (c.id)}
          <tr class="border-t border-border">
            <td class="py-2">
              {c.filename}
              {#if c.is_directory}
                <span class="text-muted-foreground"> — archive, not resumable</span>
              {/if}
            </td>
            <td>{c.kind}</td>
            <td>{c.format}</td>
            <td>{formatSize(c.size_bytes)}</td>
            <td data-testid={`mode-${c.filename}`}>
              {c.linked ? 'Linked' : 'Copy'}
            </td>
            <td class="text-right">
              {#if c.available}
                <a
                  class="underline"
                  href={downloadHref(selectedRunKey ?? '', c)}
                  aria-label={`Download ${c.filename}`}
                  download
                >
                  Download
                </a>
              {:else}
                <span class="text-muted-foreground" title={c.source_path}>
                  On disk at {c.source_path}
                </span>
              {/if}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="ml-2"
                onclick={() => remove(c.filename, c.linked)}
              >
                Remove
              </Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</RoutePage>
