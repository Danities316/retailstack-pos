/**
 * Offline Authentication
 * Manages persistent storage of auth tokens for offline login
 * Tokens are only stored after successful online login, expiring after 3 days
 */

interface OfflineAuthSession {
  token: string;
  userId: string;
  tenantId: string;
  userName: string;
  userEmail: string;
  expiresAt: number; // Timestamp when offline access expires (now + 3 days)
  storedAt: number; // Timestamp when token was stored
}

const STORAGE_KEY = 'offline_auth_session';
const OFFLINE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

/**
 * Save auth session for offline use
 * Call this immediately after successful login
 */
export function saveOfflineSession(data: {
  token: string;
  userId: string;
  tenantId: string;
  userName: string;
  userEmail: string;
}): void {
  const session: OfflineAuthSession = {
    token: data.token,
    userId: data.userId,
    tenantId: data.tenantId,
    userName: data.userName,
    userEmail: data.userEmail,
    expiresAt: Date.now() + OFFLINE_DURATION_MS,
    storedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    const hoursValid = OFFLINE_DURATION_MS / (60 * 60 * 1000);
    console.log('[OfflineAuth] ✅ Session saved for offline use', {
      userName: data.userName,
      userEmail: data.userEmail,
      validForHours: hoursValid,
      expiresAt: new Date(session.expiresAt).toISOString(),
      tokenLength: data.token.length,
    });
  } catch (err) {
    console.error('[OfflineAuth] ❌ Failed to save session:', err);
  }
}


/**
 * Restore auth session from offline storage
 * Returns session if valid (not expired and offline window open), null if expired/missing
 */
export function restoreOfflineSession(): OfflineAuthSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[OfflineAuth] ℹ️ No offline session found in storage');
      return null;
    }

    const session: OfflineAuthSession = JSON.parse(stored);

    // Check if offline access window has expired (3 days passed)
    if (Date.now() > session.expiresAt) {
      console.log('[OfflineAuth] ⏰ Session expired, removing', {
        expiredAt: new Date(session.expiresAt).toISOString(),
      });
      clearOfflineSession();
      return null;
    }

    const hoursLeft = (session.expiresAt - Date.now()) / (60 * 60 * 1000);
    console.log('[OfflineAuth] ✅ Session restored successfully', {
      userName: session.userName,
      userEmail: session.userEmail,
      hoursLeft: hoursLeft.toFixed(1),
      expiresAt: new Date(session.expiresAt).toISOString(),
    });

    return session;
  } catch (err) {
    console.error('[OfflineAuth] ❌ Failed to restore session:', err);
    return null;
  }
}

/**
 * Check if offline session is still valid
 * Useful for gating features that require valid auth
 */
export function isOfflineSessionValid(): boolean {
  const session = restoreOfflineSession();
  return session !== null;
}

/**
 * Get current offline session token for API calls
 * Returns token if session valid, undefined if expired/missing
 */
export function getOfflineToken(): string | undefined {
  const session = restoreOfflineSession();
  return session?.token;
}

/**
 * Get offline session user info
 * Useful for showing user context in offline mode
 */
export function getOfflineSessionUser() {
  const session = restoreOfflineSession();
  if (!session) return null;
  return {
    id: session.userId,
    name: session.userName,
    email: session.userEmail,
    tenantId: session.tenantId,
  };
}

/**
 * Clear offline session (call on logout)
 * This immediately revokes offline access
 * CRITICAL: Must be called BEFORE any page refresh to prevent restoration
 */
export function clearOfflineSession(): void {
  try {
    const wasStored = !!localStorage.getItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)

    if (wasStored) {
      console.log('[OfflineAuth] ✅ Session cleared on logout')
    } else {
      console.log('[OfflineAuth] ℹ️ No offline session to clear')
    }
  } catch (err) {
    console.error('[OfflineAuth] ❌ Failed to clear session:', err)
  }
}

/**
 * Get remaining offline access time in hours
 * Useful for displaying "X hours left" to user
 */
export function getOfflineAccessRemainingHours(): number {
  const session = restoreOfflineSession();
  if (!session) return 0;
  const ms = session.expiresAt - Date.now();
  return Math.max(0, ms / (60 * 60 * 1000));
}

/**
 * Check if user is currently in offline mode
 * True if: offline AND has valid session
 * False if: online OR no valid session
 */
export function isInOfflineMode(): boolean {
  return !navigator.onLine && isOfflineSessionValid();
}
