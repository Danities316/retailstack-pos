import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { useSyncManager } from '@/hooks/useSyncManager';
import { globalSyncOrchestrator } from '@/sync/SyncOrchestrator';

/**
 * PendingChangesPage: Shows all pending mutations waiting to sync
 * Allows user to view, retry, or discard pending changes
 */
export function PendingChangesPage() {
    const { isSyncing, syncNow } = useSyncManager();
    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load pending items on mount and when sync completes
    useEffect(() => {
        const loadPendingItems = () => {
            setIsLoading(true);
            const items = globalSyncOrchestrator.getPendingItems();
            setPendingItems(items);
            setIsLoading(false);
        };

        loadPendingItems();

        // Reload when sync completes
        const interval = setInterval(loadPendingItems, 2000);
        return () => clearInterval(interval);
    }, [isSyncing]);

    const handleRetry = (key: string) => {
        console.log('[PendingChangesPage] Retrying item:', key);
        syncNow();
    };

    const handleRetryAll = () => {
        console.log('[PendingChangesPage] Retrying all pending items');
        syncNow();
    };

    const getStateIcon = (state: string) => {
        switch (state) {
            case 'PENDING':
                return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
            case 'RETRYING':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'POISONED':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStateLabel = (state: string) => {
        switch (state) {
            case 'PENDING':
                return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>;
            case 'RETRYING':
                return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Retrying</span>;
            case 'POISONED':
                return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Failed</span>;
            default:
                return null;
        }
    };

    const getMutationTypeLabel = (type: string) => {
        const typeStyles = {
            CREATE: 'bg-green-100 text-green-800',
            UPDATE: 'bg-blue-100 text-blue-800',
            DELETE: 'bg-red-100 text-red-800',
        };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded ${typeStyles[type as keyof typeof typeStyles] || ''}`}>
                {type}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pending Changes</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} waiting to sync
                    </p>
                </div>
                <button
                    onClick={handleRetryAll}
                    disabled={isSyncing || pendingItems.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Retry All'}
                </button>
            </div>

            {/* Empty State */}
            {isLoading ? (
                <div className="p-8 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">Loading pending changes...</p>
                </div>
            ) : pendingItems.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                        ✅ All changes synced!
                    </p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                        Your data is up to date.
                    </p>
                </div>
            ) : (
                /* Pending Items Table */
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Entity ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Operation
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Retries
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {pendingItems.map((item) => (
                                <tr key={item.idempotencyKey} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-mono break-words">
                                        {item.entityId}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {item.entityType}
                                    </td>
                                    <td className="px-6 py-3 text-sm">
                                        {getMutationTypeLabel(item.mutationType)}
                                    </td>
                                    <td className="px-6 py-3 text-sm">
                                        {getStateLabel(item.state)}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {item.retryCount}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(item.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 text-sm">
                                        <button
                                            onClick={() => handleRetry(item.idempotencyKey)}
                                            disabled={isSyncing}
                                            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-medium"
                                            title="Retry this item"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-100">
                    💡 <strong>TIP:</strong> Pending changes sync automatically every 30 seconds when you're online.
                    You can manually trigger a sync using the "Retry All" button above or the "Sync Now" button in the header.
                </p>
            </div>
        </div>
    );
}

export default PendingChangesPage;
