/**
 * Offline Authentication
 * Stores the auth session in IndexedDB (retailstack_pos → offlineAuth store)
 * instead of localStorage, so it is not directly readable in DevTools
 * Application → Local Storage on a shared POS device.
 *
 * API contract is identical to the previous localStorage version:
 *   - saveOfflineSession()            → async, write to IDB
 *   - restoreOfflineSession()         → sync, reads in-memory cache
 *   - clearOfflineSession()           → async, removes from IDB + clears cache
 *   - getOfflineToken()               → sync, reads cache
 *   - getOfflineSessionUser()         → sync, reads cache
 *   - isOfflineSessionValid()         → sync, reads cache
 *   - isInOfflineMode()               → sync, reads cache + navigator.onLine
 *   - getOfflineAccessRemainingHours()→ sync, reads cache
 *
 * IMPORTANT: call initOfflineAuth() once at app boot (before React renders)
 * so the cache is populated before any sync read happens.
 */

import { openDatabase } from '@/offline/db'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineAuthSession {
  token: string
  userId: string
  tenantId: string
  userName: string
  userEmail: string
  expiresAt: number  // ms timestamp: now + 3 days
  storedAt: number   // ms timestamp: when saved
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORE_NAME = 'offlineAuth'
const SESSION_KEY = 'session'
const OFFLINE_DURATION_MS = 3 * 24 * 60 * 60 * 1000  // 3 days

// ── In-memory cache ───────────────────────────────────────────────────────────
// Populated by initOfflineAuth() at boot, kept in sync by save/clear.
// All sync reads come from here — no IDB round-trip after boot.

let _cache: OfflineAuthSession | null = null

// ── IDB helpers ───────────────────────────────────────────────────────────────

async function getAuthStore(mode: 'readonly' | 'readwrite'): Promise<IDBObjectStore> {
  // openDatabase() handles all migrations including migrateToV3 (offlineAuth store).
  // The store is guaranteed to exist after openDatabase() resolves.
  const db = await openDatabase()
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

async function idbGet(): Promise<OfflineAuthSession | null> {
  return new Promise(async (resolve) => {
    try {
      const store = await getAuthStore('readonly')
      const req = store.get(SESSION_KEY)
      req.onsuccess = () => {
        const record = req.result
        resolve(record ? (record.value as OfflineAuthSession) : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(session: OfflineAuthSession): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const store = await getAuthStore('readwrite')
      const req = store.put({ key: SESSION_KEY, value: session })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

async function idbDelete(): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const store = await getAuthStore('readwrite')
      const req = store.delete(SESSION_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

// ── Boot init ─────────────────────────────────────────────────────────────────

/**
 * Load the session from IndexedDB into the in-memory cache.
 * Call once at app startup alongside initializeSyncQueue(), before React renders.
 *
 *   initializeSyncQueue()
 *     .then(() => initOfflineAuth())
 *     .then(() => render())
 */
export async function initOfflineAuth(): Promise<void> {
  try {
    const stored = await idbGet()
    if (!stored) {
      console.log('[OfflineAuth] No session found in IDB')
      return
    }
    if (Date.now() > stored.expiresAt) {
      console.log('[OfflineAuth] Stored session expired, clearing')
      await idbDelete()
      _cache = null
      return
    }
    _cache = stored
    const hoursLeft = (stored.expiresAt - Date.now()) / (60 * 60 * 1000)
    console.log('[OfflineAuth] Session restored from IDB', {
      userName: stored.userName,
      hoursLeft: hoursLeft.toFixed(1),
    })
  } catch (err) {
    console.error('[OfflineAuth] initOfflineAuth failed:', err)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save auth session after a successful online login.
 * Writes to IDB and updates the in-memory cache atomically.
 */
export async function saveOfflineSession(data: {
  token: string
  userId: string
  tenantId: string
  userName: string
  userEmail: string
}): Promise<void> {
  const session: OfflineAuthSession = {
    ...data,
    expiresAt: Date.now() + OFFLINE_DURATION_MS,
    storedAt: Date.now(),
  }
  try {
    await idbSet(session)
    _cache = session
    const hoursValid = OFFLINE_DURATION_MS / (60 * 60 * 1000)
    console.log('[OfflineAuth] Session saved to IDB', {
      userName: data.userName,
      validForHours: hoursValid,
    })
  } catch (err) {
    console.error('[OfflineAuth] Failed to save session to IDB:', err)
    throw err
  }
}

/**
 * Synchronous read from in-memory cache.
 * Returns null if session is missing or expired.
 * Relies on initOfflineAuth() having been called at boot.
 */
export function restoreOfflineSession(): OfflineAuthSession | null {
  if (!_cache) return null
  if (Date.now() > _cache.expiresAt) {
    clearOfflineSession().catch(() => { })
    return null
  }
  return _cache
}

/**
 * Clear the session on logout.
 * Clears IDB and in-memory cache. Call before any page refresh.
 */
export async function clearOfflineSession(): Promise<void> {
  _cache = null
  try {
    await idbDelete()
    console.log('[OfflineAuth] Session cleared')
  } catch (err) {
    console.error('[OfflineAuth] Failed to clear session from IDB:', err)
  }
}

// ── Convenience helpers (sync — all read from cache) ─────────────────────────

export function isOfflineSessionValid(): boolean {
  return restoreOfflineSession() !== null
}

export function getOfflineToken(): string | undefined {
  return restoreOfflineSession()?.token
}

export function getOfflineSessionUser() {
  const s = restoreOfflineSession()
  if (!s) return null
  return { id: s.userId, name: s.userName, email: s.userEmail, tenantId: s.tenantId }
}

export function getOfflineAccessRemainingHours(): number {
  const s = restoreOfflineSession()
  if (!s) return 0
  return Math.max(0, (s.expiresAt - Date.now()) / (60 * 60 * 1000))
}

export function isInOfflineMode(): boolean {
  return !navigator.onLine && isOfflineSessionValid()
}

// /**
//  * Offline Authentication
//  * Manages persistent storage of auth tokens for offline login
//  * Tokens are only stored after successful online login, expiring after 3 days
//  */

// interface OfflineAuthSession {
//   token: string;
//   userId: string;
//   tenantId: string;
//   userName: string;
//   userEmail: string;
//   expiresAt: number; // Timestamp when offline access expires (now + 3 days)
//   storedAt: number; // Timestamp when token was stored
// }

// const STORAGE_KEY = 'offline_auth_session';
// const OFFLINE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

// /**
//  * Save auth session for offline use
//  * Call this immediately after successful login
//  */
// export function saveOfflineSession(data: {
//   token: string;
//   userId: string;
//   tenantId: string;
//   userName: string;
//   userEmail: string;
// }): void {
//   const session: OfflineAuthSession = {
//     token: data.token,
//     userId: data.userId,
//     tenantId: data.tenantId,
//     userName: data.userName,
//     userEmail: data.userEmail,
//     expiresAt: Date.now() + OFFLINE_DURATION_MS,
//     storedAt: Date.now(),
//   };

//   try {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
//     const hoursValid = OFFLINE_DURATION_MS / (60 * 60 * 1000);
//     console.log('[OfflineAuth] ✅ Session saved for offline use', {
//       userName: data.userName,
//       userEmail: data.userEmail,
//       validForHours: hoursValid,
//       expiresAt: new Date(session.expiresAt).toISOString(),
//       tokenLength: data.token.length,
//     });
//   } catch (err) {
//     console.error('[OfflineAuth] ❌ Failed to save session:', err);
//   }
// }


// /**
//  * Restore auth session from offline storage
//  * Returns session if valid (not expired and offline window open), null if expired/missing
//  */
// export function restoreOfflineSession(): OfflineAuthSession | null {
//   try {
//     const stored = localStorage.getItem(STORAGE_KEY);
//     if (!stored) {
//       console.log('[OfflineAuth] ℹ️ No offline session found in storage');
//       return null;
//     }

//     const session: OfflineAuthSession = JSON.parse(stored);

//     // Check if offline access window has expired (3 days passed)
//     if (Date.now() > session.expiresAt) {
//       console.log('[OfflineAuth] ⏰ Session expired, removing', {
//         expiredAt: new Date(session.expiresAt).toISOString(),
//       });
//       clearOfflineSession();
//       return null;
//     }

//     const hoursLeft = (session.expiresAt - Date.now()) / (60 * 60 * 1000);
//     console.log('[OfflineAuth] ✅ Session restored successfully', {
//       userName: session.userName,
//       userEmail: session.userEmail,
//       hoursLeft: hoursLeft.toFixed(1),
//       expiresAt: new Date(session.expiresAt).toISOString(),
//     });

//     return session;
//   } catch (err) {
//     console.error('[OfflineAuth] ❌ Failed to restore session:', err);
//     return null;
//   }
// }

// /**
//  * Check if offline session is still valid
//  * Useful for gating features that require valid auth
//  */
// export function isOfflineSessionValid(): boolean {
//   const session = restoreOfflineSession();
//   return session !== null;
// }

// /**
//  * Get current offline session token for API calls
//  * Returns token if session valid, undefined if expired/missing
//  */
// export function getOfflineToken(): string | undefined {
//   const session = restoreOfflineSession();
//   return session?.token;
// }

// /**
//  * Get offline session user info
//  * Useful for showing user context in offline mode
//  */
// export function getOfflineSessionUser() {
//   const session = restoreOfflineSession();
//   if (!session) return null;
//   return {
//     id: session.userId,
//     name: session.userName,
//     email: session.userEmail,
//     tenantId: session.tenantId,
//   };
// }

// /**
//  * Clear offline session (call on logout)
//  * This immediately revokes offline access
//  * CRITICAL: Must be called BEFORE any page refresh to prevent restoration
//  */
// export function clearOfflineSession(): void {
//   try {
//     const wasStored = !!localStorage.getItem(STORAGE_KEY)
//     localStorage.removeItem(STORAGE_KEY)

//     if (wasStored) {
//       console.log('[OfflineAuth] ✅ Session cleared on logout')
//     } else {
//       console.log('[OfflineAuth] ℹ️ No offline session to clear')
//     }
//   } catch (err) {
//     console.error('[OfflineAuth] ❌ Failed to clear session:', err)
//   }
// }

// /**
//  * Get remaining offline access time in hours
//  * Useful for displaying "X hours left" to user
//  */
// export function getOfflineAccessRemainingHours(): number {
//   const session = restoreOfflineSession();
//   if (!session) return 0;
//   const ms = session.expiresAt - Date.now();
//   return Math.max(0, ms / (60 * 60 * 1000));
// }

// /**
//  * Check if user is currently in offline mode
//  * True if: offline AND has valid session
//  * False if: online OR no valid session
//  */
// export function isInOfflineMode(): boolean {
//   return !navigator.onLine && isOfflineSessionValid();
// }
