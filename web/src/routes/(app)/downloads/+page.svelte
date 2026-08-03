<script lang="ts">
  import { createDownloadRunsQuery, createDownloadRunQuery } from '$lib/api/queries';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import { Button } from '$lib/components/ui/button';
  import { api } from '$lib/api/client';
  import { toast } from 'svelte-sonner';
  import { tick } from 'svelte';
  import { Download, Trash2 } from '@lucide/svelte';

  const runsQuery = createDownloadRunsQuery();

  let AlertDialog = $state<typeof import('$lib/components/ui/alert-dialog/index.js') | null>(null);
  let pendingRemoval = $state<{ filename: string; linked: boolean } | null>(null);

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
  const artifacts = $derived($runQuery.data?.artifacts ?? []);

  function artifactHref(runKey: string, kind: string): string {
    return `/api/downloads/runs/${encodeURIComponent(runKey)}/artifacts/${kind}`;
  }

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

  // Deleting a link frees nothing while the OneTrainer original survives;
  // deleting a copy frees the bytes now. Those are opposite outcomes, so the
  // confirmation has to say which one this is.
  const removalMessage = $derived(
    pendingRemoval === null
      ? ''
      : pendingRemoval.linked
        ? `${pendingRemoval.filename} is a link to the file OneTrainer wrote. Removing it here keeps the original, so no disk space is freed.`
        : `${pendingRemoval.filename} is the web UI's own copy. Removing it deletes those bytes and the space will be freed.`
  );

  async function requestRemove(filename: string, linked: boolean) {
    if (!AlertDialog) {
      AlertDialog = await import('$lib/components/ui/alert-dialog/index.js');
      await tick();
    }
    pendingRemoval = { filename, linked };
  }

  async function confirmRemove() {
    // Capture before the first await: the dialog closes immediately and the
    // deriveds it reads are gone by the time the request settles.
    const target = pendingRemoval;
    const key = selectedRunKey;
    const query = $runQuery;
    pendingRemoval = null;
    if (!target || !key) return;

    try {
      await api.deleteCheckpoint(key, target.filename);
      toast.success(`Removed ${target.filename}`);
      await query.refetch();
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
      No runs yet. A run appears here as soon as training starts, with its config and
      logs — and its checkpoints once it saves any.
    </p>
  {:else}
    <section class="mb-6">
      <h2 class="text-sm font-semibold mb-2">Run artifacts</h2>
      <table class="w-full text-sm">
        <tbody>
          {#each artifacts as a (a.kind)}
            <tr class="border-t border-border">
              <td class="py-2">
                {a.label}
                {#if a.kind === 'tensorboard' && a.available}
                  <span class="text-muted-foreground"> — compressed on download</span>
                {/if}
              </td>
              <td>{a.available ? formatSize(a.size_bytes) : ''}</td>
              <td class="text-right">
                {#if a.available}
                  <a
                    class="underline"
                    href={artifactHref(selectedRunKey ?? '', a.kind)}
                    aria-label={`Download ${a.label}`}
                    download
                  >
                    Download{a.is_archive ? ' .zip' : ''}
                  </a>
                {:else}
                  <span class="text-muted-foreground">Not available for this run</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <table class="w-full text-sm">
      <thead>
        <!-- Six columns overflow a phone. File and Size are the two worth
             keeping; Kind, Format and Storage return at md. -->
        <tr class="text-left text-muted-foreground">
          <th class="py-2">File</th>
          <th class="hidden md:table-cell">Kind</th>
          <th class="hidden md:table-cell">Format</th>
          <th>Size</th>
          <th class="hidden md:table-cell">Storage</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <!-- Keyed on filename, not id: _unique_name guarantees it is unique
             within a run, whereas older manifests can carry reissued ids. -->
        {#each checkpoints as c (c.filename)}
          <tr class="border-t border-border">
            <td class="py-2">
              {c.filename}
              {#if c.is_directory}
                <span class="text-muted-foreground"> — archive, not resumable</span>
              {/if}
            </td>
            <td class="hidden md:table-cell">{c.kind}</td>
            <td class="hidden md:table-cell">{c.format}</td>
            <td class="whitespace-nowrap tabular-nums">{formatSize(c.size_bytes)}</td>
            <td class="hidden md:table-cell" data-testid={`mode-${c.filename}`}>
              {c.linked ? 'Linked' : 'Copy'}
            </td>
            <td class="text-right whitespace-nowrap">
              <!-- Only an explicit false means "we never stored this", matching
                   the store's own check; a manifest without the field is not
                   read as unavailable. -->
              {#if c.available !== false}
                <a
                  class="underline inline-flex items-center align-middle"
                  href={downloadHref(selectedRunKey ?? '', c)}
                  aria-label={`Download ${c.filename}`}
                  download
                >
                  <Download class="size-4 md:hidden" aria-hidden="true" />
                  <span class="hidden md:inline">Download</span>
                </a>
              {:else}
                <span class="text-muted-foreground" title={c.source_path}>
                  <span class="hidden md:inline">On disk at {c.source_path}</span>
                  <span class="md:hidden">On disk</span>
                </span>
              {/if}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                class="ml-2"
                aria-label={`Remove ${c.filename}`}
                onclick={() => requestRemove(c.filename, c.linked)}
              >
                <Trash2 class="size-4 md:hidden" aria-hidden="true" />
                <span class="hidden md:inline">Remove</span>
              </Button>
            </td>
          </tr>
        {/each}
        {#if checkpoints.length === 0}
          <tr class="border-t border-border">
            <td class="py-2 text-muted-foreground" colspan="6">
              No checkpoints for this run.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  {/if}
</RoutePage>

{#if AlertDialog}
  <AlertDialog.Root
    open={pendingRemoval !== null}
    onOpenChange={(v) => {
      if (!v) pendingRemoval = null;
    }}
  >
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Remove this checkpoint?</AlertDialog.Title>
        <AlertDialog.Description>{removalMessage}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => (pendingRemoval = null)}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action onclick={confirmRemove}>Remove</AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
