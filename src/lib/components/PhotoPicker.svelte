<script lang="ts">
  import type { PhotoRecord } from '$lib/data/schema';
  import { preparePhoto } from '$lib/platform/photos';
  import { runtime } from '$lib/platform/runtime';

  let {
    programId,
    onphoto
  }: { programId: string; onphoto: (photo: PhotoRecord | null) => void } = $props();

  let status = $state<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  let message = $state('');
  let preview = $state('');

  async function selectPhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    status = 'preparing';
    message = '';
    try {
      const photo = await preparePhoto(file, { id: runtime.createId(), programId });
      preview = URL.createObjectURL(photo.blob);
      onphoto(photo);
      status = 'ready';
    } catch (error) {
      onphoto(null);
      message = error instanceof Error ? error.message : 'This photo could not be prepared.';
      status = 'error';
    }
  }

  function removePhoto() {
    if (preview) URL.revokeObjectURL(preview);
    preview = '';
    status = 'idle';
    onphoto(null);
  }
</script>

<div class="photo-picker">
  <label>
    <span>Add an optional photo</span>
    <input type="file" accept="image/*" onchange={selectPhoto} />
  </label>
  <div aria-live="polite">
    {#if status === 'preparing'}
      <p>Preparing photo…</p>
    {:else if status === 'ready'}
      <div class="preview">
        <img src={preview} alt="Selected eating moment" />
        <div><strong>Stored only on this device</strong><button type="button" onclick={removePhoto}>Remove</button></div>
      </div>
    {:else if status === 'error'}
      <p class="error">{message}</p>
    {/if}
  </div>
</div>

<style>
  label {
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  label span {
    font-weight: 700;
  }

  input {
    width: 110px;
    min-height: 44px;
  }

  .preview {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 72px 1fr;
    align-items: center;
    gap: 12px;
  }

  img {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    object-fit: cover;
  }

  .preview strong {
    display: block;
    font-size: 14px;
  }

  button {
    min-width: 72px;
    min-height: 44px;
    margin-top: 4px;
    border: 0;
    color: var(--primary);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  p {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .error {
    color: var(--danger);
  }
</style>
