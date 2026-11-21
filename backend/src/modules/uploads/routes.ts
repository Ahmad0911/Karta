import { createHash } from 'node:crypto'

import type { Deps } from '../../deps.ts'
import { AppError, tooMany } from '../../platform/errors.ts'
import { requireRole, type Router } from '../../platform/http.ts'

export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp'

/** True when the URL is one of OUR uploaded photos (or any https image when no host is configured, for dev). */
export function isOurImage(deps: Deps, url: string): boolean {
  const cld = deps.config.cloudinary
  if (!cld) return /^https:\/\/[^\s]+$/.test(url)
  return url.startsWith(`https://res.cloudinary.com/${cld.cloudName}/image/upload/`) && !/\s/.test(url)
}

export function uploadRoutes(router: Router, deps: Deps) {
  /**
   * The browser uploads the photo directly to Cloudinary; this only hands out a short signature that is
   * valid for one folder and a few minutes. The API secret never leaves the server.
   */
  router.post('/api/uploads/sign', requireRole('vendor', 'customer'), (ctx) => {
    const cld = deps.config.cloudinary
    if (!cld) throw new AppError(503, 'uploads_unavailable', 'Photo uploads aren’t available yet.')
    const wait = deps.limiter.check(`upload-sign:${ctx.user!.id}`, 40, 3_600_000)
    if (wait) throw tooMany(wait)

    const folder = ctx.user!.role === 'vendor' ? 'karta/listings' : 'karta/requests'
    const timestamp = Math.floor(deps.clock.now() / 1000)
    // Cloudinary signs the parameters in alphabetical order, then the secret is appended.
    const toSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${folder}&timestamp=${timestamp}`
    const signature = createHash('sha1').update(toSign + cld.apiSecret).digest('hex')
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cld.cloudName}/image/upload`,
      fields: { api_key: cld.apiKey, timestamp, folder, allowed_formats: ALLOWED_FORMATS, signature },
      maxBytes: 5 * 1024 * 1024,
    }
  })
}
