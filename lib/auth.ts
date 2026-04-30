export const MAX_FAILED_LOGIN_ATTEMPTS = 3
export const ACCOUNT_LOCK_MINUTES = 15
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32
export const PASSWORD_MIN_LENGTH = 6

export function sanitizeUsername(username: string) {
  return username.trim()
}

export function normalizeUsername(username: string) {
  return sanitizeUsername(username).toLowerCase()
}

export function validateUsernameInput(username: string) {
  const value = sanitizeUsername(username)

  if (!value) {
    return "Username is required."
  }

  if (value.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters long.`
  }

  if (value.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`
  }

  return null
}

export function validateUsernamePresence(username: string) {
  if (!sanitizeUsername(username)) {
    return "Username is required."
  }

  return null
}

export function validatePasswordPresence(password: string) {
  if (!password.trim()) {
    return "Password is required."
  }

  return null
}

export function validatePasswordInput(password: string) {
  const presenceError = validatePasswordPresence(password)
  if (presenceError) {
    return presenceError
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`
  }

  return null
}

export function formatLockMessage(lockUntil: Date | string) {
  const date = lockUntil instanceof Date ? lockUntil : new Date(lockUntil)

  if (Number.isNaN(date.valueOf())) {
    return "Your account is temporarily locked. Please try again later."
  }

  return `Your account is temporarily locked until ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC.`
}
