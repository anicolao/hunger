import type { PhotoRecord } from '$lib/data/schema';

export function storablePhoto(photo: PhotoRecord): PhotoRecord {
  return {
    id: photo.id,
    programId: photo.programId,
    blob: photo.blob,
    mediaType: photo.mediaType,
    width: photo.width,
    height: photo.height,
    bytes: photo.bytes
  };
}

const MAX_EDGE = 1280;
const TARGET_BYTES = 350 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This photo could not be prepared.'))),
      'image/webp',
      quality
    );
  });
}

export async function preparePhoto(
  source: File,
  input: { id: string; programId: string }
): Promise<PhotoRecord> {
  if (!source.type.startsWith('image/')) throw new Error('Choose an image file.');

  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the photo.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.42) {
    quality -= 0.1;
    blob = await canvasBlob(canvas, quality);
  }

  if (blob.size > TARGET_BYTES) throw new Error('This photo is too detailed to store safely.');

  return {
    id: input.id,
    programId: input.programId,
    blob,
    mediaType: blob.type,
    width,
    height,
    bytes: blob.size
  };
}
