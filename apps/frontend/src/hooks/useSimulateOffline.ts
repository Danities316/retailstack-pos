/**
 * useSimulateOffline — dev-only offline simulation hook
 *
 * Provides a toggle that forces the app to behave as if it is offline,
 * without touching the network, IndexedDB, or any queue state.
 *
 * HOW IT WORKS
 * ------------
 * - simulateOffline is persisted in localStorage so it survives refresh.
 * - isEffectivelyOnline is the single derived value every sync guard must use:
 *     const isEffectivelyOnline = navigator.onLine && !simulateOffline
 * - When the toggle turns ON  → dispatches window 'offline' event so any
 *   component listening to that event (NewSalePage, Sidebar, etc.) reacts
 *   automatically without any code changes in those components.
 * - When the toggle turns OFF → dispatches window 'online' event, which
 *   useSyncManager's handleOnline listener picks up and triggers a sync.
 *
 * SAFETY
 * ------
 * - Does NOT touch IndexedDB.
 * - Does NOT clear the SyncQueue.
 * - Does NOT affect navigator.onLine itself (read-only browser property).
 * - Enabled only when import.meta.env.DEV is true. In production builds
 *   the toggle renders nothing and simulateOffline is always false.
 *
 * USAGE
 * -----
 *   import { useSimulateOffline } from '@/hooks/useSimulateOffline';
 *   const { simulateOffline, isEffectivelyOnline, toggle } = useSimulateOffline();
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'simulateOffline';

function readPersistedValue(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function useSimulateOffline() {
    // In production this hook is a no-op — simulateOffline is always false.
    const isDev = import.meta.env.DEV;

    const [simulateOffline, setSimulateOffline] = useState<boolean>(
        isDev ? readPersistedValue() : false
    );

    // Derived value — this is the single source of truth for online status.
    // Every sync guard in useSyncManager reads this via the exported getter.
    const isEffectivelyOnline = navigator.onLine && !simulateOffline;

    const toggle = useCallback(() => {
        if (!isDev) return;

        setSimulateOffline(prev => {
            const next = !prev;

            // Persist across refresh
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                // localStorage blocked — still works in memory for this session
            }

            // Dispatch fake browser event so existing listeners react
            // automatically (NewSalePage, Sidebar, useSyncManager handleOnline)
            window.dispatchEvent(new Event(next ? 'offline' : 'online'));

            return next;
        });
    }, [isDev]);

    // On mount: if simulateOffline was true before refresh, re-dispatch the
    // 'offline' event so useSyncManager's handleOnline is never triggered
    // and the UI shows the correct offline state from the first render.
    useEffect(() => {
        if (isDev && simulateOffline) {
            window.dispatchEvent(new Event('offline'));
        }
        // Intentionally runs only on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        simulateOffline: isDev ? simulateOffline : false,
        isEffectivelyOnline,
        toggle,
        isDev,
    };
}

/**
 * getIsEffectivelyOnline — non-hook version for use inside useSyncManager
 * where hooks cannot be called.
 *
 * Reads localStorage directly. Safe to call in any sync guard.
 */
export function getIsEffectivelyOnline(): boolean {
    const simulated = import.meta.env.DEV
        ? localStorage.getItem('simulateOffline') === 'true'
        : false;
    return navigator.onLine && !simulated;
}
