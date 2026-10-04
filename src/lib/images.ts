/**
 * Browser-side image preparation for the mock.
 *
 * Photos are shrunk to a web-friendly size and stored as data URLs so the
 * prototype works without a backend. In production, upload the original
 * file to object storage (S3/Cloudinary) through the API and store the URL.
 */

const MAX_EDGE = 900
const QUALITY = 0.72
export const MAX_FILE_MB = 8
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export type ImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string }

export async function prepareImage(file: File): Promise<ImageResult> {
  if (!ACCEPTED.includes(file.type)) {
    return { ok: false, error: `${file.name}: use a JPG, PNG or WebP image.` }
  }

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { ok: false, error: `${file.name}: images must be under ${MAX_FILE_MB} MB.` }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')

    // JPEG has no alpha; paint white first so transparent PNGs don't go black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', QUALITY) }
  } catch {
    return { ok: false, error: `${file.name}: we couldn’t read this image.` }
  }
}
