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

  let contextSheet: HTMLDialogElement;

  function openContextSheet() {
    contextSheet.showModal();
  }

  function closeContextSheet() {
    contextSheet.close();
  }
</script>

<button class="disclosure" type="button" onclick={openContextSheet}>
  <span>{reduced ? 'Optional details' : 'Add optional context'}</span>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
</button>

<dialog bind:this={contextSheet} aria-labelledby="context-title">
  <div class="sheet-handle" aria-hidden="true"></div>
  <div class="sheet-heading">
    <div>
      <p>Optional</p>
      <h2 id="context-title">Add context</h2>
    </div>
    <button class="done" type="button" onclick={closeContextSheet}>Done</button>
  </div>
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
</dialog>

<style>
  .disclosure {
    width: 100%;
    min-height: 52px;
    margin-top: 16px;
    padding: 0;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    color: var(--primary);
    background: transparent;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .disclosure svg {
    width: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  dialog {
    width: min(100% - 20px, 620px);
    max-height: min(82svh, 720px);
    margin: auto auto 0;
    padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
    overflow: auto;
    border: 1px solid var(--rim);
    border-radius: 26px 26px 0 0;
    color: var(--ink);
    background: var(--glass-strong);
    box-shadow: 0 -20px 70px rgb(0 0 0 / .25);
    backdrop-filter: blur(30px) saturate(140%);
  }

  dialog::backdrop {
    background: rgb(8 18 17 / .45);
    backdrop-filter: blur(3px);
  }

  .sheet-handle {
    width: 42px;
    height: 5px;
    margin: 0 auto 8px;
    border-radius: 999px;
    background: var(--border-strong);
  }

  .sheet-heading {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .sheet-heading p,
  .sheet-heading h2 { margin: 0; }
  .sheet-heading p { color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .sheet-heading h2 { font-size: 24px; }
  .done { min-width: 52px; min-height: 44px; border: 0; color: var(--primary); background: transparent; font: inherit; font-weight: 800; }

  .context-fields {
    padding: 10px 0 4px;
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

  @media (min-width: 660px) {
    dialog { margin: auto; border-radius: 26px; }
  }
</style>
