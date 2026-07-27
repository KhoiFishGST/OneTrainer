<script lang="ts">
  import PageHeader from './PageHeader.svelte';
  import TabBar from './TabBar.svelte';
  import Alert from './Alert.svelte';
  import Toast from './Toast.svelte';
  import FormPageSkeleton from './FormPageSkeleton.svelte';

  let {
    active = 'one',
    message = 'Saved',
    tone = 'success',
    duration = 4000,
    onSelect = () => {},
    onDismiss = () => {}
  } = $props<{
    active?: string;
    message?: string;
    tone?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    onSelect?: (id: string) => void;
    onDismiss?: () => void;
  }>();
</script>

{#snippet description()}<p>Page description</p>{/snippet}
{#snippet status()}<span>Ready</span>{/snippet}
{#snippet actions()}<a href="/next">Next</a>{/snippet}

<PageHeader title="Settings" {description} {status} {actions} />
<TabBar
  tabs={[{ id: 'page-one', label: 'Page One' }, { id: 'page-two', label: 'Page Two' }]}
  active="page-one"
  variant="page"
  class="page-tabs-test"
  {onSelect}
/>
<TabBar tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }]} {active} variant="dialog" {onSelect} />
<Alert tone="error">Persistent failure</Alert>
<Toast {message} {tone} {duration} {onDismiss} />
<FormPageSkeleton rows={2} label="Loading settings" />
