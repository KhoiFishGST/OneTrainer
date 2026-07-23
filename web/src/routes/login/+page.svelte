<script lang="ts">
  import { onMount } from 'svelte';
  import { Lock, ShieldAlert, ArrowRight } from 'lucide-svelte';

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
        <Lock size={32} />
      </div>
      <h1 class="brand-title">OneTrainer Portal</h1>
      <p class="brand-subtitle">Protected Instance Access</p>
    </div>

    {#if isHttpInsecure}
      <div class="security-warning" role="alert">
        <ShieldAlert size={20} class="warning-icon" />
        <div>
          <strong>Insecure HTTP Connection</strong>
          <p>Your password will be transmitted in plain text. Consider enabling HTTPS.</p>
        </div>
      </div>
    {/if}

    <form onsubmit={handleLogin} class="login-form">
      {#if errorMsg}
        <div class="error-banner" role="alert">
          <span>{errorMsg}</span>
        </div>
      {/if}

      <div class="form-group">
        <label for="portal-password">Password</label>
        <input
          id="portal-password"
          type="password"
          bind:value={password}
          placeholder="Enter portal password..."
          required
          autofocus
        />
      </div>

      <button type="submit" class="submit-btn" disabled={loading || !password}>
        {#if loading}
          <span>Signing in...</span>
        {:else}
          <span>Sign In</span>
          <ArrowRight size={18} />
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .login-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-root, #0b0f19);
    padding: 1.5rem;
  }

  .login-container {
    width: 100%;
    max-width: 400px;
    background-color: var(--panel, #1f2937);
    border: 1px solid var(--line, #374151);
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
    background-color: rgba(99, 102, 241, 0.15);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent, #6366f1);
  }

  .brand-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text, #f3f4f6);
    margin: 0 0 0.25rem;
  }

  .brand-subtitle {
    font-size: 0.875rem;
    color: var(--muted, #9ca3af);
    margin: 0;
  }

  .security-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background-color: rgba(220, 38, 38, 0.15);
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    color: #f87171;
    font-size: 0.875rem;
  }

  .warning-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .security-warning p {
    margin: 0.25rem 0 0;
    color: #fca5a5;
    font-size: 0.75rem;
  }

  .error-banner {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #f87171;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
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
    color: var(--text, #f3f4f6);
  }

  .form-group input {
    padding: 0.75rem 1rem;
    background-color: var(--panel-raised, #111827);
    border: 1px solid var(--line, #374151);
    border-radius: 8px;
    color: var(--text, #f3f4f6);
    font-size: 0.95rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent, #6366f1);
  }

  .submit-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--accent, #6366f1);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.2s ease;
  }

  .submit-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
