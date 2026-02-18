/**
 * SyncStatus: Show sync state, pending mutations, and manual trigger.
 */

import React from 'react';

export interface SyncStatusProps {
    status: 'IDLE' | 'SYNCING' | 'ERROR';
    pendingMutations: number;
    lastSyncTime?: string;
    error?: string;
    onManualSync: () => Promise<void>;
}

/**
 * Component: Display sync status and controls.
 */
export function SyncStatus({
    status,
    pendingMutations,
    lastSyncTime,
    error,
    onManualSync,
}: SyncStatusProps) {
    const [syncing, setSyncing] = React.useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await onManualSync();
        } finally {
            setSyncing(false);
        }
    };

    const statusColor = {
        IDLE: '#4caf50',
        SYNCING: '#2196f3',
        ERROR: '#ff6b6b',
    }[status];

    return (
        <div style={styles.container}>
            <div style={styles.statusBar}>
                <div style={{ ...styles.statusIndicator, backgroundColor: statusColor }} />
                <span style={styles.statusText}>{status}</span>

                {pendingMutations > 0 && (
                    <span style={styles.badge}>
                        {pendingMutations} pending
                    </span>
                )}

                {lastSyncTime && (
                    <span style={styles.syncTime}>
                        Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {error && <div style={styles.errorMessage}>{error}</div>}

            <button
                style={styles.syncButton}
                onClick={handleSync}
                disabled={syncing || status === 'SYNCING'}
            >
                {syncing || status === 'SYNCING' ? '⟳ Syncing...' : '⟳ Sync Now'}
            </button>
        </div>
    );
}

/**
 * Styles (basic example).
 */
const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '12px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        marginBottom: '16px',
    },
    statusBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
    },
    statusIndicator: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
    },
    statusText: {
        fontWeight: 'bold',
        fontSize: '14px',
    },
    badge: {
        backgroundColor: '#ff9800',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        marginLeft: 'auto',
    },
    syncTime: {
        fontSize: '12px',
        color: '#999',
    },
    errorMessage: {
        color: '#ff6b6b',
        fontSize: '12px',
        marginBottom: '8px',
    },
    syncButton: {
        padding: '8px 16px',
        backgroundColor: '#2196f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
};
