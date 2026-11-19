/** Every expected failure is an AppError. Anything else is a bug and becomes a generic 500. */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) => new AppError(400, code, message, details)
export const unauthorized = (message = 'Please sign in.', code = 'unauthorized') => new AppError(401, code, message)
export const forbidden = (message = 'You don’t have access to this.', code = 'forbidden') => new AppError(403, code, message)
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message)
export const conflict = (code: string, message: string) => new AppError(409, code, message)
export const invalid = (fields: Record<string, string>, message = 'Please check the highlighted fields.') => new AppError(422, 'validation_failed', message, { fields })
export const unprocessable = (field: string, message: string) => invalid({ [field]: message }, message)
export const tooMany = (retryAfterSec: number, message = 'Too many requests. Please try again shortly.') => new AppError(429, 'rate_limited', message, { retryAfterSec })
