const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein123', 'karta123',
])

/** Returns a message when the password is unacceptable, otherwise null. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 8) return 'Your password needs at least 8 characters.'
  if (password.length > 128) return 'Your password is too long (128 characters maximum).'
  if (/^\d+$/.test(password)) return 'Add some letters. A password of only numbers is easy to guess.'
  if (COMMON.has(password.toLowerCase())) return 'That password is too common. Please choose another.'
  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Your password shouldn’t contain your email name.'
  return null
}
