/**
 * useOnlineStatus — single source of truth for online/offline state.
 *
 * Unifies:
 *   - navigator.onLine (real browser network status)
 *   - getIsEffectivelyOnline() (respects dev simulate-offline toggle)
 *
 * Both real network changes AND the simulate-offline toggle dispatch
 * 'online'/'offline' events on window, so one listener covers both.
 */
import { useState, useEffect } from 'react';
import { getIsEffectivelyOnline } from './useSimulateOffline';

export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState<boolean>(getIsEffectivelyOnline);

    useEffect(() => {
        const handleOnline = () => setIsOnline(getIsEffectivelyOnline());
        const handleOffline = () => setIsOnline(getIsEffectivelyOnline());

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}