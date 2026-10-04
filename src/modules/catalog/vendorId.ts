/** Stable public id for a platform vendor, derived from their account email. */
export const vendorIdFor = (email: string) =>
  `vnd_${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
