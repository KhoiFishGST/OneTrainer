<script lang="ts">
  import { onMount } from 'svelte';
  import { ShieldAlert, Key, Eye, EyeOff, Save, Lock, Unlock } from 'lucide-svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
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
        saveStatus = { type: 'error', message: 'Failed to save secrets.' };
      }
    } catch (e) {
      saveStatus = { type: 'error', message: 'Network error saving secrets.' };
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

  function handleClearPassword() {
    saveSecrets({ webui_password: '' });
    webuiPassword = '';
  }
</script>

<div class="secrets-page">
  <PageHeader title="Secrets & Security Settings" class="secrets-header" />

  {#if isHttpInsecure}
    <Alert variant="destructive" class="secrets-insecure-alert">
      <ShieldAlert size={24} class="banner-icon" />
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
      <Alert variant="destructive" class="secrets-alert">
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
          <Key size={20} class="card-icon" />
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
            />
            <Button
              variant="ghost"
              size="icon"
              class="icon-btn"
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
          <Button variant="default" class="btn primary" onclick={handleSaveHfToken}>
            <Save size={16} /> Save Token
          </Button>
        </div>
      </div>

      <!-- Web Portal Authentication Card -->
      <div class="settings-card">
        <div class="card-header">
          {#if webuiPasswordSet}
            <Lock size={20} class="card-icon" />
          {:else}
            <Unlock size={20} class="card-icon" />
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
            />
            <Button
              variant="ghost"
              size="icon"
              class="icon-btn"
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
          <Button variant="default" class="btn primary" onclick={handleSavePassword}>
            <Save size={16} /> Update Password
          </Button>
          {#if webuiPasswordSet}
            <Button variant="destructive" class="btn danger" onclick={() => (isConfirmClearOpen = true)}>
              Clear Password
            </Button>
          {/if}
        </div>
      </div>
    </div>

    <AlertDialog.Root open={isConfirmClearOpen} onOpenChange={(v) => (isConfirmClearOpen = v)}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Clear Web Portal Password?</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to clear password protection? This will allow open access to your instance.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel onclick={() => (isConfirmClearOpen = false)}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action
            onclick={() => {
              isConfirmClearOpen = false;
              handleClearPassword();
            }}
          >
            Confirm Clear
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {/if}
</div>

<style>
  .secrets-page {
    padding: 1.5rem;
    max-width: 900px;
  }

  .secrets-page :global(.secrets-header) {
    margin-bottom: 1.5rem;
  }

  .secrets-page :global(.secrets-insecure-alert) {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    background-color: rgba(220, 38, 38, 0.15);
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    color: #f87171;
  }

  .secrets-page :global(.secrets-toast) {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .secrets-page :global(.secrets-toast.toast--success) {
    background-color: rgba(16, 185, 129, 0.15);
    border: 1px solid #10b981;
    color: #34d399;
  }

  .secrets-page :global(.secrets-alert) {
    display: block;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #f87171;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .secrets-page :global(.secrets-insecure-alert) :global(.banner-icon) {
    color: #ef4444;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .banner-text strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .banner-text p {
    font-size: 0.875rem;
    line-height: 1.4;
    margin: 0;
    color: #fca5a5;
  }

  .card-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-card {
    background-color: var(--panel, #1f2937);
    border: 1px solid var(--line, #374151);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-header :global(.card-icon) {
    color: var(--color-primary, var(--accent, #3b82f6));
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-title, var(--accent, #3b82f6));
    margin: 0;
  }

  .card-description {
    font-size: 0.875rem;
    color: var(--muted, #9ca3af);
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
    color: var(--text, #f3f4f6);
  }

  .input-with-button {
    display: flex;
    position: relative;
    align-items: center;
  }

  .input-with-button :global(.text-input) {
    min-width: 0;
    width: 100%;
    padding: 0.625rem 2.5rem 0.625rem 0.75rem;
    background-color: var(--panel-raised, #111827);
    border: 1px solid var(--line, #374151);
    border-radius: 6px;
    color: var(--text, #f3f4f6);
    font-size: 0.875rem;
  }

  .input-with-button :global(.text-input:focus) {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: none;
  }

  .input-with-button :global(.icon-btn) {
    position: absolute;
    right: 0.5rem;
    min-height: 0;
    width: auto;
    height: auto;
    background: transparent;
    border: none;
    color: var(--muted, #9ca3af);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .input-with-button :global(.icon-btn:hover) {
    color: var(--text, #f3f4f6);
  }

  .status-badge {
    font-size: 0.75rem;
    color: var(--muted, #9ca3af);
    margin-top: 0.25rem;
  }

  .status-badge.configured {
    color: #10b981;
    font-weight: 500;
  }

  .card-actions {
    display: flex;
    gap: 0.75rem;
  }

  .card-actions :global(.btn) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 0;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .card-actions :global(.btn.primary) {
    background-color: var(--color-primary, var(--accent, #3b82f6));
    color: white;
  }

  .card-actions :global(.btn.primary:hover) {
    filter: brightness(1.1);
  }

  .card-actions :global(.btn.danger) {
    background-color: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #f87171;
  }

  .card-actions :global(.btn.danger:hover) {
    background-color: rgba(239, 68, 68, 0.3);
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
