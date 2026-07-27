<script lang="ts">
  let { title }: { title: string } = $props();
</script>

<div class="section-divider" role="separator">
  <span class="section-divider-title">{title}</span>
  <div class="section-divider-line"></div>
</div>

<style>
  .section-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    padding-top: 0.75rem;
    width: 100%;
    box-sizing: border-box;
  }

  .section-divider-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-title, var(--accent, #3b82f6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .section-divider-line {
    flex: 1;
    height: 1px;
    background-color: var(--color-border, var(--line, #2d3741));
  }
</style>
