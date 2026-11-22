import { ApiError, apiPost } from '@/lib/api'
import { prepareImage } from '@/lib/images'

interface Signature {
  uploadUrl: string
  fields: Record<string, string | number>
  maxBytes: number
}

const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob()

/**
 * Shrink the photo in the browser, then send it straight to Cloudinary with a short-lived signature from our API.
 * Returns the https link to store. The API secret never reaches the browser.
 */
export async function uploadPhoto(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const prepared = await prepareImage(file)
  if (!prepared.ok) return prepared

  try {
    const sig = await apiPost<Signature>('/uploads/sign')
    const blob = await toBlob(prepared.dataUrl)
    if (blob.size > sig.maxBytes) return { ok: false, error: `${file.name}: the photo is still too large. Try a smaller one.` }

    const body = new FormData()
    body.append('file', blob, file.name.replace(/\.[^.]+$/, '') + '.jpg')
    for (const [k, v] of Object.entries(sig.fields)) body.append(k, String(v))

    const res = await fetch(sig.uploadUrl, { method: 'POST', body })
    if (!res.ok) return { ok: false, error: `${file.name}: the upload didn’t go through. Please try again.` }
    const json = (await res.json()) as { secure_url?: string }
    if (!json.secure_url) return { ok: false, error: `${file.name}: the upload didn’t go through. Please try again.` }
    return { ok: true, url: json.secure_url }
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return { ok: false, error: 'Photo uploads aren’t available yet. Please try again later.' }
    return { ok: false, error: `${file.name}: the upload didn’t go through. Please try again.` }
  }
}
