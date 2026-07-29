<script lang="ts">
  import { onMount } from 'svelte';
  import { ShieldAlert, Key, Eye, EyeOff, Save, Lock, Unlock } from '@lucide/svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { toast as sonnerToast } from 'svelte-sonner';

  let huggingfaceToken = $state('');
  let hfTokenSet = $state(false);
  let webuiPassword = $state('');
  let webuiPasswordSet = $state(false);

  let showHfToken = $state(false);
  let showWebuiPassword = $state(false);

  let isHttpInsecure = $state(false);
  let saveStatus = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let loading = $state(true);
  let isConfirmClearOpen = $state(false);

  $effect(() => {
    if (saveStatus) {
      if (saveStatus.type === 'success') {
        sonnerToast.success(saveStatus.message);
      }
      const timer = setTimeout(() => {
        saveStatus = null;
      }, 3000);
      return () => clearTimeout(timer);
    }
  });

  onMount(async () => {
    if (typeof window !== 'undefined') {
      const isHttp = window.location.protocol === 'http:';
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      isHttpInsecure = isHttp && !isLocal;
    }

    await loadSecrets();
  });

  async function loadSecrets() {
    loading = true;
    try {
      const res = await fetch('/api/secrets');
      if (res.ok) {
        const data = await res.json();
        huggingfaceToken = data.huggingface_token || '';
        hfTokenSet = !!data.huggingface_token_set;
        webuiPasswordSet = !!data.webui_password_set;
      }
    } catch (e) {
      console.error('Failed to load secrets', e);
    } finally {
      loading = false;
    }
  }

  let isClearingPassword = $state(false);
  let clearPasswordError = $state<string | null>(null);

  async function saveSecrets(updates: { huggingface_token?: string; webui_password?: string }) {
    saveStatus = null;
    try {
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        hfTokenSet = data.huggingface_token_set;
        webuiPasswordSet = data.webui_password_set;
        saveStatus = { type: 'success', message: 'Secrets saved successfully!' };
      } else {
        const msg = 'Failed to save secrets.';
        saveStatus = { type: 'error', message: msg };
        throw new Error(msg);
      }
    } catch (e: any) {
      const msg = e?.message || 'Network error saving secrets.';
      if (!saveStatus) {
        saveStatus = { type: 'error', message: msg };
      }
      throw e;
    }
  }

  function handleSaveHfToken() {
    saveSecrets({ huggingface_token: huggingfaceToken });
  }

  function handleSavePassword() {
    if (!webuiPassword) {
      saveStatus = { type: 'error', message: 'Password cannot be empty. Use "Clear Password" to disable.' };
      return;
    }
    saveSecrets({ webui_password: webuiPassword });
    webuiPassword = '';
  }

  async function handleClearPassword() {
    if (isClearingPassword) return;
    isClearingPassword = true;
    clearPasswordError = null;
    try {
      await saveSecrets({ webui_password: '' });
      webuiPassword = '';
      isConfirmClearOpen = false;
    } catch (e: any) {
      clearPasswordError = e?.message || 'Failed to clear password.';
    } finally {
      isClearingPassword = false;
    }
  }
</script>

<RoutePage>
  <PageHeader title="Secrets & Security Settings" />

  {#if isHttpInsecure}
    <Alert variant="destructive" class="flex items-start gap-4">
      <ShieldAlert size={24} class="mt-0.5 shrink-0 text-destructive" />
      <div class="banner-text">
        <strong>Insecure Connection (HTTP) Detected</strong>
        <p>
          Your connection to OneTrainer is not encrypted. Passwords and API tokens entered on this page could be intercepted over the network in plain text. Consider enabling HTTPS or putting OneTrainer behind a secure reverse proxy (such as Caddy or Nginx).
        </p>
      </div>
    </Alert>
  {/if}

  {#if saveStatus}
    {#if saveStatus.type === 'error'}
      <Alert variant="destructive" class="mb-4 block p-3 text-sm font-medium">
        <span>{saveStatus.message}</span>
      </Alert>
    {:else}
      <div role="status" class="sr-only">
        {saveStatus.message}
      </div>
    {/if}
  {/if}

  {#if loading}
    <div role="status" aria-label="Loading secrets" class="skeleton-container">
      <Skeleton class="h-[120px] w-full" />
      <Skeleton class="h-[120px] w-full" />
    </div>
  {:else}
    <div class="card-grid">
      <!-- Hugging Face Token Card -->
      <div class="settings-card">
        <div class="card-header">
          <Key size={20} class="text-primary" />
          <h2 class="card-title">Hugging Face Access Token</h2>
        </div>
        <p class="card-description">
          Provide your Hugging Face User Access Token to download gated base models (such as FLUX.1-dev, SD3, or Gemma) and bypass rate limits.
        </p>

        <div class="form-group">
          <label for="hf-token-input">API Token</label>
          <div class="input-with-button">
            <TextInput
              id="hf-token-input"
              type={showHfToken ? 'text' : 'password'}
              value={huggingfaceToken}
              onInput={(val) => (huggingfaceToken = val)}
              placeholder="hf_..."
              autocomplete="off"
              ariaLabel="API Token"
              class="pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              class="absolute right-2 text-muted-foreground hover:text-foreground"
              onclick={() => (showHfToken = !showHfToken)}
              aria-label={showHfToken ? 'Hide token' : 'Show token'}
            >
              {#if showHfToken}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </Button>
          </div>
          <span class="status-badge" class:configured={hfTokenSet}>
            {hfTokenSet ? 'Token configured' : 'No token set'}
          </span>
        </div>

        <div class="card-actions">
          <Button variant="default" class="flex items-center gap-2 font-medium" onclick={handleSaveHfToken}>
            <Save size={16} /> Save Token
          </Button>
        </div>
      </div>

      <!-- Web Portal Authentication Card -->
      <div class="settings-card">
        <div class="card-header">
          {#if webuiPasswordSet}
            <Lock size={20} class="text-primary" />
          {:else}
            <Unlock size={20} class="text-primary" />
          {/if}
          <h2 class="card-title">Web Portal Password Protection</h2>
        </div>
        <p class="card-description">
          Set a Web Portal Password to restrict unauthorized access to your OneTrainer instance. Leave empty to allow open access.
        </p>

        <div class="form-group">
          <label for="webui-password-input">New Web Portal Password</label>
          <div class="input-with-button">
            <TextInput
              id="webui-password-input"
              type={showWebuiPassword ? 'text' : 'password'}
              value={webuiPassword}
              onInput={(val) => (webuiPassword = val)}
              placeholder={webuiPasswordSet ? 'Enter new password to change...' : 'Enter new password...'}
              autocomplete="off"
              ariaLabel="New Web Portal Password"
              class="pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              class="absolute right-2 text-muted-foreground hover:text-foreground"
              onclick={() => (showWebuiPassword = !showWebuiPassword)}
              aria-label={showWebuiPassword ? 'Hide password' : 'Show password'}
            >
              {#if showWebuiPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </Button>
          </div>
          <span class="status-badge" class:configured={webuiPasswordSet}>
            {webuiPasswordSet ? '✓ Password Protection Enabled' : 'Password Protection Disabled (Open Access)'}
          </span>
        </div>

        <div class="card-actions">
          <Button variant="default" class="flex items-center gap-2 font-medium" onclick={handleSavePassword}>
            <Save size={16} /> Update Password
          </Button>
          {#if webuiPasswordSet}
            <Button variant="destructive" class="flex items-center gap-2 font-medium" onclick={() => { isConfirmClearOpen = true; clearPasswordError = null; }}>
              Clear Password
            </Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</RoutePage>

<AlertDialog.Root open={isConfirmClearOpen} onOpenChange={(v) => { if (!v && !isClearingPassword) { isConfirmClearOpen = false; clearPasswordError = null; } }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Clear Web Portal Password?</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to clear password protection? This will allow open access to your instance.
      </AlertDialog.Description>
    </AlertDialog.Header>
    {#if clearPasswordError}
      <Alert variant="destructive" class="my-2">
        <span>{clearPasswordError}</span>
      </Alert>
    {/if}
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isClearingPassword} onclick={() => { isConfirmClearOpen = false; clearPasswordError = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={isClearingPassword}
        onclick={handleClearPassword}
      >
        Confirm Clear
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<style>
  .banner-text strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .banner-text p {
    font-size: 0.875rem;
    line-height: 1.4;
    margin: 0;
    color: var(--destructive);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: 1.5rem;
    align-items: start;
  }

  .settings-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary);
    margin: 0;
  }

  .card-description {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    margin-bottom: 1.25rem;
    line-height: 1.4;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .input-with-button {
    display: flex;
    position: relative;
    align-items: center;
  }

  .status-badge {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    margin-top: 0.25rem;
  }

  .status-badge.configured {
    color: rgb(16, 185, 129);
    font-weight: 500;
  }

  .card-actions {
    display: flex;
    gap: 0.75rem;
  }

  .skeleton-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: 1.5rem;
  }
</style>
