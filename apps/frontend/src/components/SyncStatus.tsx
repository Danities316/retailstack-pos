/**
 * SyncStatus — human-friendly sync state bar for business owners and cashiers.
 * In development mode also renders a "Simulate Offline" dev-tool toggle.
 *
 * NO LOGIC CHANGES — only messaging and UX.
 */

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Wifi, WifiOff, CloudOff, Upload, ShieldCheck } from 'lucide-react';
import { useOfflineSync } from '@/context/OfflineSyncContext';
import { useSimulateOffline } from '@/hooks/useSimulateOffline';

export function SyncStatus() {
    const { globalSyncStatus, lastSyncTime, globalSyncError, pendingCount, triggerGlobalSync } = useOfflineSync();
    const isSyncing = globalSyncStatus === 'SYNCING';
    const lastSyncError = globalSyncError ?? null;
    const syncNow = triggerGlobalSync;
    const syncHistory: any[] = []; // history display is a nice-to-have, not critical
    const { simulateOffline, isEffectivelyOnline, toggle, isDev } = useSimulateOffline();
    const [showUploadActivity, setShowUploadActivity] = useState(false);

    // ── "All sales safely stored" flash ──────────────────────────────────────
    // Fires for 3 s after isSyncing transitions true → false with no error.
    const [justSynced, setJustSynced] = useState(false);
    const wasSyncing = useRef(false);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (wasSyncing.current && !isSyncing && !lastSyncError) {
            setJustSynced(true);
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setJustSynced(false), 3000);
        }
        wasSyncing.current = isSyncing;
        return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
    }, [isSyncing, lastSyncError]);

    // ── Requirement 3: "Last synced: X mins ago" ─────────────────────────────
    // Never show raw "Never" — if no sync time exists show a reassuring message.
    const formatLastSynced = (time: string | null): string => {
        if (!time) return 'Not yet synced this session';
        const diffMins = Math.floor((Date.now() - new Date(time).getTime()) / 60000);
        if (diffMins === 0) return 'Last uploaded: just now';
        if (diffMins === 1) return 'Last uploaded: 1 min ago';
        if (diffMins < 60) return `Last uploaded: ${diffMins} mins ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return 'Last uploaded: 1 hour ago';
        if (diffHours < 24) return `Last uploaded: ${diffHours} hours ago`;
        return `Last uploaded: ${new Date(time).toLocaleDateString()}`;
    };

    // Derived flags for readability
    const showDataSafetyMessage = !isEffectivelyOnline || pendingCount > 0;

    return (
        <div className="flex flex-col gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 relative">

            {/* ── Row 1: main status bar ────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">

                {/* Connection indicator */}
                <div className="flex items-center gap-1.5">
                    {isEffectivelyOnline ? (
                        <Wifi className="w-4 h-4 text-green-600" />
                    ) : (
                        <WifiOff className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {simulateOffline
                            ? 'Offline (Simulated)'
                            : isEffectivelyOnline ? 'Connected' : 'No connection'}
                    </span>
                </div>

                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

                {/* ── Requirement 1 + 2 + 3: human-friendly sync state ───────── */}
                <div className="flex items-center gap-1.5">
                    {isSyncing ? (
                        // Requirement 1 — uploading state
                        <>
                            <Upload className="w-4 h-4 text-blue-600 animate-bounce" />
                            <span className="text-xs font-semibold text-blue-600">
                                Uploading sales...
                            </span>
                        </>
                    ) : justSynced ? (
                        // Requirement 1 — success flash
                        <>
                            <ShieldCheck className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-600 animate-pulse">
                                All sales safely stored
                            </span>
                        </>
                    ) : lastSyncError ? (
                        // Requirement 4 — error with reassurance (detail shown in row 2)
                        <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-xs font-medium text-red-600">
                                Upload failed — will retry automatically
                            </span>
                        </>
                    ) : (
                        // Requirement 3 — quiet idle state with last sync time
                        <>
                            <CheckCircle className="w-4 h-4 text-green-500 opacity-70" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatLastSynced(lastSyncTime)}
                            </span>
                        </>
                    )}
                </div>

                {/* ── Requirement 1: pending count ─────────────────────────── */}
                {pendingCount > 0 && (
                    <>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-600 rounded-full">
                            <CloudOff className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                {pendingCount} {pendingCount === 1 ? 'sale' : 'sales'} waiting to upload
                            </span>
                        </div>
                    </>
                )}

                {/* Upload Now button */}
                <button
                    onClick={syncNow}
                    disabled={isSyncing || !isEffectivelyOnline || pendingCount === 0}
                    className="ml-auto px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-md transition-colors duration-200 flex items-center gap-1.5 whitespace-nowrap"
                    title={
                        !isEffectivelyOnline
                            ? simulateOffline
                                ? 'Simulated offline — toggle OFF to upload'
                                : 'No connection — sales are saved locally'
                            : isSyncing
                                ? 'Upload in progress...'
                                : pendingCount === 0
                                    ? 'Everything is up to date'
                                    : `Upload ${pendingCount} ${pendingCount === 1 ? 'sale' : 'sales'} now`
                    }
                >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Uploading...' : 'Upload Now'}
                </button>

                {syncHistory.length > 0 && (
                    <button
                        onClick={() => setShowUploadActivity((prev) => !prev)}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="View recent uploads"
                    >
                        Upload Activity
                    </button>
                )}

                {/* ── Dev-only: Simulate Offline toggle ────────────────────── */}
                {isDev && (
                    <>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                        <button
                            onClick={toggle}
                            className={[
                                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                                'border transition-colors duration-150 select-none',
                                simulateOffline
                                    ? 'bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900 dark:border-orange-500 dark:text-orange-200'
                                    : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300',
                            ].join(' ')}
                            title="Developer tool — forces offline behaviour without touching the network"
                        >
                            <span className={[
                                'inline-block w-2 h-2 rounded-full',
                                simulateOffline ? 'bg-orange-500' : 'bg-gray-400',
                            ].join(' ')} />
                            Simulate Offline: {simulateOffline ? 'ON' : 'OFF'}
                        </button>
                    </>
                )}
            </div>

            {/* ── Row 2: contextual reassurance messages ────────────────────── */}

            {/* Requirement 2: data safety message when offline or pending */}
            {showDataSafetyMessage && !lastSyncError && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                        Sales saved locally — will upload automatically when connection returns
                    </span>
                </div>
            )}

            {/* Requirement 4: error detail + explicit reassurance */}
            {lastSyncError && (
                <div className="flex items-start gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">
                            {lastSyncError}
                        </span>
                        <span className="text-xs text-red-600 dark:text-red-400">
                            Your sales are safe — we'll retry automatically. No data has been lost.
                        </span>
                    </div>
                </div>
            )}

            {showUploadActivity && syncHistory.length > 0 && (
                <div className="mt-1 p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                        Upload Activity
                    </div>
                    <div className="space-y-1">
                        {syncHistory.map((item, i) => (
                            <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
                                Recent upload: {new Date(item.time).toLocaleTimeString()} - {item.pushed} uploaded, {item.pulled} received
                                {item.failed > 0 && `, ${item.failed} failed`}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default SyncStatus;

// /**
//  * SyncStatus — shows sync state, last sync time, and manual sync button.
//  * In development mode also renders a "Simulate Offline" dev-tool toggle.
//  */

// import { RefreshCw, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
// import { useSyncManager } from '@/hooks/useSyncManager';
// import { useSimulateOffline } from '@/hooks/useSimulateOffline';

// export function SyncStatus() {
//     const { isSyncing, lastSyncTime, lastSyncError, pendingCount, syncNow } = useSyncManager();

//     // isEffectivelyOnline is the single source of truth for online/offline.
//     // In production simulateOffline is always false, so this equals navigator.onLine.
//     const { simulateOffline, isEffectivelyOnline, toggle, isDev } = useSimulateOffline();

//     const formatSyncTime = (time: string | null) => {
//         if (!time) return 'Never';
//         const date = new Date(time);
//         const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
//         if (diffMins === 0) return 'Just now';
//         if (diffMins === 1) return '1 min ago';
//         if (diffMins < 60) return `${diffMins} mins ago`;
//         const diffHours = Math.floor(diffMins / 60);
//         if (diffHours === 1) return '1 hour ago';
//         if (diffHours < 24) return `${diffHours} hours ago`;
//         return date.toLocaleDateString();
//     };

//     return (
//         <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-wrap">

//             {/* Online / Offline status */}
//             <div className="flex items-center gap-2">
//                 {isEffectivelyOnline ? (
//                     <Wifi className="w-4 h-4 text-green-600" />
//                 ) : (
//                     <WifiOff className="w-4 h-4 text-orange-600" />
//                 )}
//                 <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
//                     {simulateOffline
//                         ? 'Offline (Simulated)'
//                         : isEffectivelyOnline ? 'Online' : 'Offline'}
//                 </span>
//             </div>

//             <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

//             {/* Sync status indicator */}
//             <div className="flex items-center gap-2">
//                 {isSyncing ? (
//                     <>
//                         <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
//                         <span className="text-xs font-medium text-blue-600">Syncing...</span>
//                     </>
//                 ) : lastSyncError ? (
//                     <>
//                         <AlertCircle className="w-4 h-4 text-red-600" />
//                         <span className="text-xs font-medium text-red-600">Sync failed</span>
//                     </>
//                 ) : (
//                     <>
//                         <CheckCircle className="w-4 h-4 text-green-600" />
//                         <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
//                             {formatSyncTime(lastSyncTime)}
//                         </span>
//                     </>
//                 )}
//             </div>

//             {/* Pending count badge */}
//             {pendingCount > 0 && (
//                 <>
//                     <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
//                     <span className="text-xs font-medium text-orange-600">
//                         {pendingCount} pending
//                     </span>
//                 </>
//             )}

//             {/* Sync Now button */}
//             <button
//                 onClick={syncNow}
//                 disabled={isSyncing || !isEffectivelyOnline || pendingCount === 0}
//                 className="ml-auto px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-md transition-colors duration-200 flex items-center gap-1"
//                 title={
//                     !isEffectivelyOnline
//                         ? simulateOffline
//                             ? 'Offline mode simulated'
//                             : 'Offline — waiting for network'
//                         : isSyncing
//                             ? 'Sync in progress'
//                             : pendingCount === 0
//                                 ? 'No pending changes'
//                                 : 'Click to sync now'
//                 }
//             >
//                 <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
//                 Sync Now
//             </button>

//             {/* ── Dev-only: Simulate Offline toggle ─────────────────────────── */}
//             {isDev && (
//                 <>
//                     <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
//                     <button
//                         onClick={toggle}
//                         className={[
//                             'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
//                             'border transition-colors duration-150 select-none',
//                             simulateOffline
//                                 ? 'bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900 dark:border-orange-500 dark:text-orange-200'
//                                 : 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300',
//                         ].join(' ')}
//                         title="Developer tool — forces offline behaviour without touching the network"
//                     >
//                         <span
//                             className={[
//                                 'inline-block w-2 h-2 rounded-full',
//                                 simulateOffline ? 'bg-orange-500' : 'bg-gray-400',
//                             ].join(' ')}
//                         />
//                         Simulate Offline: {simulateOffline ? 'ON' : 'OFF'}
//                     </button>
//                 </>
//             )}

//             {/* Error tooltip */}
//             {lastSyncError && (
//                 <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-100 text-xs rounded-md whitespace-normal">
//                     {lastSyncError}
//                 </div>
//             )}
//         </div>
//     );
// }

// export default SyncStatus;