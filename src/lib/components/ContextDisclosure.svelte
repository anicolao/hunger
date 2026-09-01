<script lang="ts">
  import type { EatingReason, Occasion, PhotoRecord } from '$lib/data/schema';
  import PhotoPicker from './PhotoPicker.svelte';

  let {
    programId,
    includeReason = false,
    reason = null,
    occasion = null,
    note = '',
    onreason,
    onoccasion,
    onnote,
    onphoto,
    reduced = false
  }: {
    programId: string;
    includeReason?: boolean;
    reason?: EatingReason | null;
    occasion?: Occasion | null;
    note?: string;
    onreason?: (reason: EatingReason | null) => void;
    onoccasion: (occasion: Occasion | null) => void;
    onnote?: (note: string) => void;
    onphoto: (photo: PhotoRecord | null) => void;
    reduced?: boolean;
  } = $props();

  const reasons: { value: EatingReason; label: string }[] = [
    { value: 'physical-hunger', label: 'Physical hunger' },
    { value: 'craving', label: 'Craving' },
    { value: 'emotion', label: 'Emotion' },
    { value: 'boredom', label: 'Boredom' },
    { value: 'habit', label: 'Habit' },
    { value: 'social-context', label: 'Social/context' }
  ];
  const occasions: { value: Occasion; label: string }[] = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
    { value: 'other', label: 'Other' }
  ];
</script>

<details>
  <summary>{reduced ? 'Optional details' : 'Add optional context'}</summary>
  <div class="context-fields">
    {#if includeReason}
      <fieldset>
        <legend>What was part of this eating moment?</legend>
        <div class="chips">
          {#each reasons as item}
            <button
              type="button"
              class:selected={reason === item.value}
              aria-pressed={reason === item.value}
              onclick={() => onreason?.(reason === item.value ? null : item.value)}>{item.label}</button
            >
          {/each}
        </div>
      </fieldset>
    {/if}

    <fieldset>
      <legend>Occasion</legend>
      <div class="chips">
        {#each occasions as item}
          <button
            type="button"
            class:selected={occasion === item.value}
            aria-pressed={occasion === item.value}
            onclick={() => onoccasion(occasion === item.value ? null : item.value)}>{item.label}</button
          >
        {/each}
      </div>
    </fieldset>

    {#if includeReason}
      <label class="note-label" for="episode-note">Short note <span>Optional</span></label>
      <textarea
        id="episode-note"
        maxlength="140"
        rows="3"
        value={note}
        oninput={(event) => onnote?.((event.currentTarget as HTMLTextAreaElement).value)}
      ></textarea>
      {#if note.length > 100}<small>{140 - note.length} characters remaining</small>{/if}
    {/if}

    <PhotoPicker {programId} {onphoto} />
  </div>
</details>

<style>
  details {
    margin-top: 16px;
    border-top: 1px solid var(--border);
  }

  summary {
    min-height: 48px;
    display: flex;
    align-items: center;
    color: var(--primary);
    font-weight: 700;
    cursor: pointer;
  }

  .context-fields {
    padding: 8px 0 4px;
    display: grid;
    gap: 18px;
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend,
  .note-label {
    margin-bottom: 8px;
    font-weight: 700;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chips button {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    color: var(--ink);
    background: var(--surface);
    cursor: pointer;
  }

  .chips button.selected {
    border: 2px solid var(--primary);
    background: var(--primary-soft);
    font-weight: 700;
  }

  .note-label {
    margin: 0;
    display: flex;
    justify-content: space-between;
  }

  .note-label span,
  small {
    color: var(--ink-muted);
    font-size: 13px;
    font-weight: 400;
  }

  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    color: var(--ink);
    background: var(--surface);
    font: inherit;
    resize: vertical;
  }
</style>
