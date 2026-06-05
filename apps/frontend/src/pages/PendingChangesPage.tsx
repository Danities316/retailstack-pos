import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Clock, WifiOff } from 'lucide-react';
import { useOfflineSync } from '@/context/OfflineSyncContext';
import { globalSyncOrchestrator } from '@/sync/SyncOrchestrator';

// ── Human-readable labels ──────────────────────────────────────────────────────

function entityLabel(entityType: string, mutationType: string): string {
    const type = entityType?.toLowerCase();
    const op = mutationType?.toLowerCase();

    const typeMap: Record<string, string> = {
        sale: 'Sale',
        sales: 'Sale',
        product: 'Product',
        category: 'Category',
        shift: 'Shift',
        customer: 'Customer',
    };

    const opMap: Record<string, string> = {
        create: 'recorded offline',
        update: 'updated offline',
        delete: 'deleted offline',
    };

    const typeName = typeMap[type] ?? type;
    const opName = opMap[op] ?? op;
    return `${typeName} ${opName}`;
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) !== 1 ? 's' : ''} ago`;
}

// ── State chips ────────────────────────────────────────────────────────────────

function StateChip({ state }: { state: string }) {
    if (state === 'PENDING') return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            <Clock size={11} />
            Waiting to upload
        </span>
    );
    if (state === 'RETRYING') return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            <RefreshCw size={11} className="animate-spin" />
            Uploading now…
        </span>
    );
    if (state === 'POISONED') return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 rounded-full border border-red-200">
            <AlertCircle size={11} />
            Could not upload
        </span>
    );
    return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function PendingChangesPage() {
    const { globalSyncStatus, triggerGlobalSync } = useOfflineSync();
    const isSyncing = globalSyncStatus === 'SYNCING';

    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = () => {
            setIsLoading(true);
            setPendingItems(globalSyncOrchestrator.getPendingItems());
            setIsLoading(false);
        };
        load();
        const interval = setInterval(load, 2000);
        return () => clearInterval(interval);
    }, [isSyncing]);

    const pending = pendingItems.filter(i => i.state === 'PENDING');
    const failed = pendingItems.filter(i => i.state === 'POISONED');
    const retrying = pendingItems.filter(i => i.state === 'RETRYING');
    const total = pendingItems.length;

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Offline Sales
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        {total === 0
                            ? 'All your sales have been uploaded to the server.'
                            : `${total} sale${total !== 1 ? 's' : ''} recorded while offline — waiting to upload.`}
                    </p>
                </div>

                <button
                    onClick={() => triggerGlobalSync()}
                    disabled={isSyncing || total === 0}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Uploading…' : 'Upload Now'}
                </button>
            </div>

            {/* ── Summary pills ── */}
            {total > 0 && (
                <div className="flex flex-wrap gap-3">
                    {pending.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 font-medium">
                            <WifiOff size={14} />
                            {pending.length} waiting
                        </div>
                    )}
                    {retrying.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
                            <RefreshCw size={14} className="animate-spin" />
                            {retrying.length} uploading
                        </div>
                    )}
                    {failed.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                            <AlertCircle size={14} />
                            {failed.length} could not upload
                        </div>
                    )}
                </div>
            )}

            {/* ── Loading ── */}
            {isLoading && (
                <div className="py-12 text-center">
                    <RefreshCw size={24} className="text-gray-300 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Checking your offline sales…</p>
                </div>
            )}

            {/* ── Empty state ── */}
            {!isLoading && total === 0 && (
                <div className="py-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                    <p className="text-gray-800 dark:text-white font-semibold text-lg">
                        You are all caught up
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                        All your sales have been saved to the server.
                    </p>
                </div>
            )}

            {/* ── Items list ── */}
            {!isLoading && total > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {pendingItems.map((item) => (
                        <div key={item.idempotencyKey} className="flex items-center justify-between px-5 py-4 gap-4">

                            {/* Left: description */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {entityLabel(item.entityType, item.mutationType)}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {timeAgo(item.createdAt)}
                                    {item.retryCount > 0 && ` · tried ${item.retryCount} time${item.retryCount !== 1 ? 's' : ''}`}
                                </p>
                            </div>

                            {/* Right: status + retry */}
                            <div className="flex items-center gap-3 shrink-0">
                                <StateChip state={item.state} />
                                {item.state !== 'RETRYING' && (
                                    <button
                                        onClick={() => triggerGlobalSync()}
                                        disabled={isSyncing}
                                        className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 transition-colors"
                                        title="Try uploading now"
                                    >
                                        <RefreshCw size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Failed items explanation ── */}
            {failed.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800 mb-1">
                        {failed.length} sale{failed.length !== 1 ? 's' : ''} could not be uploaded
                    </p>
                    <p className="text-sm text-red-700">
                        This can happen if the product was sold out by another cashier before your offline sale was uploaded.
                        These sales are still saved on this device. Please contact your manager to resolve them.
                    </p>
                </div>
            )}

            {/* ── Info tip ── */}
            {total > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <p className="text-sm text-gray-500">
                        💡 Your offline sales upload automatically when your phone reconnects to the internet.
                        You do not need to do anything — just make sure you are online before closing the app.
                    </p>
                </div>
            )}

        </div>
    );
}

export default PendingChangesPage;


// import React, { useState, useEffect } from 'react';
// import { RefreshCw, Trash2, AlertCircle } from 'lucide-react';
// import { useOfflineSync } from '@/context/OfflineSyncContext';
// import { globalSyncOrchestrator } from '@/sync/SyncOrchestrator';

// /**
//  * PendingChangesPage: Shows all pending mutations waiting to sync
//  * Allows user to view, retry, or discard pending changes
//  */
// export function PendingChangesPage() {
//     const { globalSyncStatus, triggerGlobalSync } = useOfflineSync();
//     const isSyncing = globalSyncStatus === 'SYNCING';
//     const syncNow = triggerGlobalSync;
//     const [pendingItems, setPendingItems] = useState<any[]>([]);
//     const [isLoading, setIsLoading] = useState(true);

//     // Load pending items on mount and when sync completes
//     useEffect(() => {
//         const loadPendingItems = () => {
//             setIsLoading(true);
//             const items = globalSyncOrchestrator.getPendingItems();
//             setPendingItems(items);
//             setIsLoading(false);
//         };

//         loadPendingItems();

//         // Reload when sync completes
//         const interval = setInterval(loadPendingItems, 2000);
//         return () => clearInterval(interval);
//     }, [isSyncing]);

//     const handleRetry = (key: string) => {
//         console.log('[PendingChangesPage] Retrying item:', key);
//         syncNow();
//     };

//     const handleRetryAll = () => {
//         console.log('[PendingChangesPage] Retrying all pending items');
//         syncNow();
//     };

//     const getStateIcon = (state: string) => {
//         switch (state) {
//             case 'PENDING':
//                 return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
//             case 'RETRYING':
//                 return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
//             case 'POISONED':
//                 return <AlertCircle className="w-4 h-4 text-red-500" />;
//             default:
//                 return null;
//         }
//     };

//     const getStateLabel = (state: string) => {
//         switch (state) {
//             case 'PENDING':
//                 return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>;
//             case 'RETRYING':
//                 return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Retrying</span>;
//             case 'POISONED':
//                 return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Failed</span>;
//             default:
//                 return null;
//         }
//     };

//     const getMutationTypeLabel = (type: string) => {
//         const typeStyles = {
//             CREATE: 'bg-green-100 text-green-800',
//             UPDATE: 'bg-blue-100 text-blue-800',
//             DELETE: 'bg-red-100 text-red-800',
//         };
//         return (
//             <span className={`px-2 py-1 text-xs font-medium rounded ${typeStyles[type as keyof typeof typeStyles] || ''}`}>
//                 {type}
//             </span>
//         );
//     };

//     return (
//         <div className="space-y-6">
//             {/* Header */}
//             <div className="flex items-center justify-between">
//                 <div>
//                     <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pending Changes</h1>
//                     <p className="text-gray-600 dark:text-gray-400 mt-1">
//                         {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} waiting to sync
//                     </p>
//                 </div>
//                 <button
//                     onClick={handleRetryAll}
//                     disabled={isSyncing || pendingItems.length === 0}
//                     className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
//                 >
//                     <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
//                     {isSyncing ? 'Syncing...' : 'Retry All'}
//                 </button>
//             </div>

//             {/* Empty State */}
//             {isLoading ? (
//                 <div className="p-8 text-center">
//                     <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
//                     <p className="text-gray-600 dark:text-gray-400">Loading pending changes...</p>
//                 </div>
//             ) : pendingItems.length === 0 ? (
//                 <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
//                     <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
//                         ✅ All changes synced!
//                     </p>
//                     <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
//                         Your data is up to date.
//                     </p>
//                 </div>
//             ) : (
//                 /* Pending Items Table */
//                 <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
//                     <table className="w-full">
//                         <thead>
//                             <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Entity ID
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Type
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Operation
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Status
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Retries
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Created
//                                 </th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
//                                     Actions
//                                 </th>
//                             </tr>
//                         </thead>
//                         <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
//                             {pendingItems.map((item) => (
//                                 <tr key={item.idempotencyKey} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
//                                     <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-mono break-words">
//                                         {item.entityId}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
//                                         {item.entityType}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm">
//                                         {getMutationTypeLabel(item.mutationType)}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm">
//                                         {getStateLabel(item.state)}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
//                                         {item.retryCount}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
//                                         {new Date(item.createdAt).toLocaleString()}
//                                     </td>
//                                     <td className="px-6 py-3 text-sm">
//                                         <button
//                                             onClick={() => handleRetry(item.idempotencyKey)}
//                                             disabled={isSyncing}
//                                             className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium"
//                                             title="Retry this item"
//                                         >
//                                             <RefreshCw className="w-4 h-4" />
//                                         </button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             )}

//             {/* Info Box */}
//             <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
//                 <p className="text-sm text-blue-800 dark:text-blue-100">
//                     💡 <strong>TIP:</strong> Pending changes sync automatically every 30 seconds when you're online.
//                     You can manually trigger a sync using the "Retry All" button above or the "Sync Now" button in the header.
//                 </p>
//             </div>
//         </div>
//     );
// }

// export default PendingChangesPage;
