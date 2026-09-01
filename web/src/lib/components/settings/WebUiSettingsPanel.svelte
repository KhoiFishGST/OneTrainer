<script lang="ts">
  import { appearance } from '$lib/stores/appearance.svelte';
  import type { ThemeChoice } from '$lib/api/types';
  import Field from '$lib/components/form/Field.svelte';
  import FormPanel from '$lib/components/form/FormPanel.svelte';
  import ValueSelect from '$lib/components/form/ValueSelect.svelte';
  import { Switch } from '$lib/components/ui/switch';

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  // Read once per render rather than kept in state: the OS setting changes far
  // more rarely than this panel is opened, and a live listener here would
  // duplicate the one the appearance store already owns.
  const osReducesMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<FormPanel>
  <!--
    Every other setting on the General page is training config with
    workspace-draft semantics: edit a draft, it goes dirty, it saves. These two
    are client preferences that apply the instant they are touched and never
    enter the training config. Same page, two contracts -- so this says so.
  -->
  <p class="panel-note">
    These settings affect the OneTrainer web interface only. They are not part of
    your training configuration and apply immediately.
  </p>

  <Field id="appearance-theme" label="Theme">
    {#snippet children({ id })}
      <ValueSelect
        {id}
        ariaLabel="Theme"
        value={appearance.theme}
        options={themeOptions}
        onChange={(next) => appearance.setTheme(next as ThemeChoice)}
      />
    {/snippet}
  </Field>

  <Field id="appearance-animations" label="Animations">
    {#snippet children({ id })}
      <Switch
        {id}
        ariaLabel="Animations"
        checked={appearance.animations}
        onCheckedChange={(next) => appearance.setAnimations(next)}
      />
    {/snippet}
  </Field>

  {#if osReducesMotion}
    <!-- Without this the switch looks broken: it is on, and nothing moves. -->
    <p class="panel-note">
      Your system is set to reduce motion, so animations stay off regardless of
      this setting.
    </p>
  {/if}
</FormPanel>

<style>
  .panel-note {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin: 0 0 0.5rem;
    max-width: 60ch;
  }
</style>
