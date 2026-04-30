import Userodel from "@/models/userodel"
import { ACCOUNT_LOCK_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS, formatLockMessage, normalizeUsername, sanitizeUsername } from "@/lib/auth"

function getFallbackUsername() {
  return `user-${Date.now().toString().slice(-6)}`
}

async function buildUniqueUsername(baseUsername: string, excludeUserId?: string) {
  const safeBase = sanitizeUsername(baseUsername) || getFallbackUsername()
  let candidate = safeBase
  let counter = 2

  while (true) {
    const existingUser = await Userodel.findOne({
      usernameLower: normalizeUsername(candidate),
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    }).lean()

    if (!existingUser) {
      return candidate
    }

    candidate = `${safeBase}-${counter}`
    counter += 1
  }
}

export async function ensureLegacyUsernames() {
  const legacyUsers = await Userodel.find({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { username: "" },
      { usernameLower: { $exists: false } },
      { usernameLower: null },
      { usernameLower: "" },
    ],
  })

  for (const user of legacyUsers) {
    const uniqueUsername = await buildUniqueUsername(user.username || user.name || "", String(user._id))

    user.username = uniqueUsername
    user.usernameLower = normalizeUsername(uniqueUsername)
    user.name = user.name || uniqueUsername
    user.failedLoginAttempts = typeof user.failedLoginAttempts === "number" ? user.failedLoginAttempts : 0
    user.lockUntil = user.lockUntil || null

    await user.save()
  }
}

export async function findUserByUsername(username: string) {
  return Userodel.findOne({ username: sanitizeUsername(username) })
}

export async function isUsernameTaken(username: string) {
  const existingUser = await Userodel.findOne({ usernameLower: normalizeUsername(username) }).lean()
  return Boolean(existingUser)
}

export function getLockStatus(user: {
  lockUntil?: Date | null
  failedLoginAttempts?: number
}) {
  if (!user.lockUntil) {
    return { locked: false as const }
  }

  const lockedUntil = new Date(user.lockUntil)

  if (lockedUntil > new Date()) {
    return {
      locked: true as const,
      lockedUntil,
      message: formatLockMessage(lockedUntil),
    }
  }

  return { locked: false as const }
}

export async function clearExpiredLock(user: {
  lockUntil?: Date | null
  failedLoginAttempts?: number
  save: () => Promise<unknown>
}) {
  const lockStatus = getLockStatus(user)

  if (!lockStatus.locked && user.lockUntil) {
    user.lockUntil = null
    user.failedLoginAttempts = 0
    await user.save()
  }
}

export async function registerFailedLoginAttempt(user: {
  failedLoginAttempts?: number
  lockUntil?: Date | null
  save: () => Promise<unknown>
}) {
  const attempts = (user.failedLoginAttempts || 0) + 1

  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000)
    user.failedLoginAttempts = 0
    user.lockUntil = lockUntil
    await user.save()

    return {
      code: "account_locked" as const,
      message: formatLockMessage(lockUntil),
      remainingAttempts: 0,
      lockedUntil: lockUntil.toISOString(),
    }
  }

  user.failedLoginAttempts = attempts
  user.lockUntil = null
  await user.save()

  const remainingAttempts = MAX_FAILED_LOGIN_ATTEMPTS - attempts

  return {
    code: "invalid_credentials" as const,
    message: `Incorrect username or password. Please try again. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining before the account is locked.`,
    remainingAttempts,
  }
}
