<script lang="ts">
  import { onMount } from 'svelte';
  import { Lock, ShieldAlert, ArrowRight } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { Alert } from '$lib/components/ui/alert';

  let password = $state('');
  let errorMsg = $state('');
  let loading = $state(false);
  let isHttpInsecure = $state(false);

  onMount(() => {
    if (typeof window !== 'undefined') {
      const isHttp = window.location.protocol === 'http:';
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      isHttpInsecure = isHttp && !isLocal;
    }
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!password) return;

    errorMsg = '';
    loading = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        errorMsg = data.detail || 'Invalid password. Please try again.';
      }
    } catch (err) {
      errorMsg = 'Network error. Could not connect to server.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrapper">
  <div class="login-container">
    <div class="brand-header">
      <div class="logo-icon">
        <img src="/logo.png" alt="OneTrainer Logo" class="brand-logo-img" />
      </div>
      <h1 class="brand-title">OneTrainer Portal</h1>
      <p class="brand-subtitle">Protected Instance Access</p>
    </div>

    {#if isHttpInsecure}
      <Alert class="mb-6 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/15 p-3 text-sm text-destructive">
        <ShieldAlert size={20} class="mt-0.5 shrink-0" />
        <div>
          <strong>Insecure HTTP Connection</strong>
          <p class="mt-1 text-xs text-destructive/80">Your password will be transmitted in plain text. Consider enabling HTTPS.</p>
        </div>
      </Alert>
    {/if}

    <form onsubmit={handleLogin} class="login-form">
      {#if errorMsg}
        <Alert variant="destructive" class="mb-5 block rounded-md p-2.5 text-sm">
          {errorMsg}
        </Alert>
      {/if}

      <div class="form-group">
        <label for="portal-password">Password</label>
        <TextInput
          id="portal-password"
          type="password"
          value={password}
          onInput={(val) => (password = val)}
          placeholder="Enter portal password..."
          required
          autofocus
          ariaLabel="Password"
        />
      </div>

      <Button type="submit" variant="default" size="lg" class="w-full justify-center gap-2" disabled={loading || !password}>
        {#if loading}
          <span>Signing in...</span>
        {:else}
          <span>Sign In</span>
          <ArrowRight size={18} />
        {/if}
      </Button>
    </form>
  </div>
</div>

<style>
  .login-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--background, #0b0f19);
    padding: 1.5rem;
  }

  .login-container {
    width: 100%;
    max-width: 400px;
    background-color: var(--card, #1f2937);
    border: 1px solid var(--border, #374151);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .brand-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    background-color: var(--muted, #111827);
    border: 1px solid var(--border, #374151);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-logo-img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }

  .brand-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--foreground, #f3f4f6);
    margin: 0 0 0.25rem;
  }

  .brand-subtitle {
    font-size: 0.875rem;
    color: var(--muted-foreground, #9ca3af);
    margin: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground, #f3f4f6);
  }
</style>
