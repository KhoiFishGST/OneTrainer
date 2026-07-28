<script lang="ts">
  import type { ConceptTextConfig } from '$lib/api/types';
  import Field from '$lib/components/form/Field.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import DirectoryInput from '$lib/components/form/DirectoryInput.svelte';

  let {
    text = $bindable(),
    onBrowsePath,
  }: {
    text: ConceptTextConfig;
    onBrowsePath: (mode: 'dir' | 'file', target: 'concept' | 'prompt' | 'special_tags', currentPath: string) => void;
  } = $props();
</script>

<div class="form-stack">
  <Field
    id="aug-tag-options"
    label="Tag Options"
    tooltip="Enable tag shuffling and/or tag dropout"
  >
    {#snippet children({ id: _id, ariaDescribedBy: _aria })}
      <div class="tag-options-row">
        <label class="inline-toggle-item" title="Enables tag shuffling">
          <Toggle
            id="aug-tag-shuffle-inline"
            value={text.enable_tag_shuffling}
            onChange={(val) => {
              text.enable_tag_shuffling = val;
            }}
          />
          <span>Shuffling</span>
        </label>

        <label class="inline-toggle-item" title="Enables random dropout for tags in captions">
          <Toggle
            id="aug-tag-dropout-inline"
            value={text.tag_dropout_enable}
            onChange={(val) => {
              text.tag_dropout_enable = val;
            }}
          />
          <span>Dropout</span>
        </label>
      </div>
    {/snippet}
  </Field>

  <Field id="aug-tag-delim" label="Tag Delimiter" tooltip="The delimiter between tags">
    {#snippet children({ id, ariaDescribedBy })}
      <TextInput
        {id}
        value={text.tag_delimiter || ','}
        {ariaDescribedBy}
        onInput={(val) => {
          text.tag_delimiter = val;
        }}
        placeholder=","
      />
    {/snippet}
  </Field>

  <Field
    id="aug-keep-tags"
    label="Keep Tag Count"
    tooltip="Number of tags at start of caption that are not shuffled or dropped"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={text.keep_tags_count ?? 1}
        {ariaDescribedBy}
        onInput={(val) => {
          text.keep_tags_count = parseInt(val, 10) || 0;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-dropout-mode"
    label="Dropout Mode"
    tooltip="FULL: drop entire caption past kept tags; RANDOM: drop individual tags; RANDOM WEIGHTED: linearly increase drop probability"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Select
        {id}
        value={text.tag_dropout_mode || 'FULL'}
        options={[
          { value: 'FULL', label: 'Full' },
          { value: 'RANDOM', label: 'Random' },
          { value: 'RANDOM WEIGHTED', label: 'Random Weighted' },
        ]}
        {ariaDescribedBy}
        onChange={(v) => {
          text.tag_dropout_mode = v;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-dropout-prob"
    label="Probability"
    tooltip="Probability to drop tags (0 to 1)"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={text.tag_dropout_probability ?? 0.0}
        {ariaDescribedBy}
        onInput={(val) => {
          text.tag_dropout_probability = parseFloat(val) || 0;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-special-tags-mode"
    label="Special Dropout Tags Mode"
    tooltip="Whitelist/blacklist mode for tag dropout"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Select
        {id}
        value={text.tag_dropout_special_tags_mode || 'NONE'}
        options={[
          { value: 'NONE', label: 'None' },
          { value: 'BLACKLIST', label: 'Blacklist' },
          { value: 'WHITELIST', label: 'Whitelist' },
        ]}
        {ariaDescribedBy}
        onChange={(v) => {
          text.tag_dropout_special_tags_mode = v;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-special-tags"
    label="Special Dropout Tags List"
    tooltip="List of tags for whitelist/blacklist or filepath to .txt/.csv file"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <DirectoryInput
        {id}
        value={text.tag_dropout_special_tags || ''}
        {ariaDescribedBy}
        buttonLabel="Browse"
        onInput={(val) => {
          text.tag_dropout_special_tags = val;
        }}
        onOpenDirectory={(curr) => onBrowsePath('file', 'special_tags', curr)}
        placeholder="tag1, tag2 or /path/to/tags.txt"
      />
    {/snippet}
  </Field>

  <Field
    id="aug-special-tags-regex"
    label="Special Tags Regex"
    tooltip="Interpret special tags with regular expressions"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Toggle
        {id}
        value={text.tag_dropout_special_tags_regex ?? false}
        {ariaDescribedBy}
        onChange={(val) => {
          text.tag_dropout_special_tags_regex = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-caps-randomize"
    label="Randomize Capitalization"
    tooltip="Enables randomization of capitalization for tags in caption"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Toggle
        {id}
        value={text.caps_randomize_enable ?? false}
        {ariaDescribedBy}
        onChange={(val) => {
          text.caps_randomize_enable = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-caps-lowercase"
    label="Force Lowercase"
    tooltip="Converts caption to lowercase before processing"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Toggle
        {id}
        value={text.caps_randomize_lowercase ?? false}
        {ariaDescribedBy}
        onChange={(val) => {
          text.caps_randomize_lowercase = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="aug-caps-mode"
    label="Capitalization Mode"
    tooltip="Comma-separated capitalization modes: capslock, title, first, random"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <TextInput
        {id}
        value={text.caps_randomize_mode || ''}
        {ariaDescribedBy}
        onInput={(val) => {
          text.caps_randomize_mode = val;
        }}
        placeholder="capslock, title, first, random"
      />
    {/snippet}
  </Field>

  <Field
    id="aug-caps-prob"
    label="Probability"
    tooltip="Probability to randomize capitalization (0 to 1)"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={text.caps_randomize_probability ?? 0.0}
        {ariaDescribedBy}
        onInput={(val) => {
          text.caps_randomize_probability = parseFloat(val) || 0;
        }}
      />
    {/snippet}
  </Field>
</div>

<style>
  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .tag-options-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .inline-toggle-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text, #e6ebef);
    cursor: pointer;
  }
</style>
