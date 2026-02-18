/**
 * ConflictIndicator: Show when data has unresolved conflicts.
 * UI never auto-resolves; shows the problem and waits for user decision.
 */

import React from 'react';

export interface ConflictIndicatorProps {
    entityId: string;
    entityType: string;
    clientData: any;
    serverData: any;
    onResolve: (resolution: any) => Promise<void>;
    isLoading?: boolean;
}

/**
 * Component: Display conflict and allow user to pick a version.
 */
export function ConflictIndicator({
    entityId,
    entityType,
    clientData,
    serverData,
    onResolve,
    isLoading = false,
}: ConflictIndicatorProps) {
    const [selectedVersion, setSelectedVersion] = React.useState<'client' | 'server' | null>(null);
    const [resolving, setResolving] = React.useState(false);

    const handleResolve = async () => {
        if (!selectedVersion) return;

        setResolving(true);
        try {
            const resolution = selectedVersion === 'client' ? clientData : serverData;
            await onResolve(resolution);
        } finally {
            setResolving(false);
        }
    };

    return (
        <div className="conflict-indicator" style={styles.container}>
            <div style={styles.header}>
                <span style={styles.badge}>⚠️ CONFLICT</span>
                <span style={styles.entity}>
                    {entityType} {entityId}
                </span>
            </div>

            <div style={styles.content}>
                <div style={styles.version}>
                    <h4>Your Changes</h4>
                    <pre>{JSON.stringify(clientData, null, 2)}</pre>
                    <button
                        style={{
                            ...styles.button,
                            ...(selectedVersion === 'client' ? styles.buttonSelected : {}),
                        }}
                        onClick={() => setSelectedVersion('client')}
                        disabled={resolving}
                    >
                        ✓ Keep Your Changes
                    </button>
                </div>

                <div style={styles.vs}>VS</div>

                <div style={styles.version}>
                    <h4>Server Latest</h4>
                    <pre>{JSON.stringify(serverData, null, 2)}</pre>
                    <button
                        style={{
                            ...styles.button,
                            ...(selectedVersion === 'server' ? styles.buttonSelected : {}),
                        }}
                        onClick={() => setSelectedVersion('server')}
                        disabled={resolving}
                    >
                        ✓ Accept Server Version
                    </button>
                </div>
            </div>

            <div style={styles.actions}>
                <button
                    style={{ ...styles.button, ...styles.primaryButton }}
                    onClick={handleResolve}
                    disabled={!selectedVersion || resolving}
                >
                    {resolving ? 'Resolving...' : 'Resolve Conflict'}
                </button>
            </div>
        </div>
    );
}

/**
 * Styles (basic example; use CSS modules in production).
 */
const styles: Record<string, React.CSSProperties> = {
    container: {
        border: '2px solid #ff6b6b',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#ffe0e0',
        marginBottom: '16px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: '#ff6b6b',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
    },
    entity: {
        fontSize: '14px',
        color: '#666',
    },
    content: {
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
    },
    version: {
        flex: 1,
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '4px',
    },
    vs: {
        display: 'flex',
        alignItems: 'center',
        fontWeight: 'bold',
        color: '#666',
    },
    button: {
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #ddd',
        backgroundColor: '#f5f5f5',
        cursor: 'pointer',
        marginTop: '8px',
    },
    buttonSelected: {
        backgroundColor: '#4caf50',
        color: 'white',
        borderColor: '#4caf50',
    },
    primaryButton: {
        backgroundColor: '#2196f3',
        color: 'white',
        borderColor: '#2196f3',
    },
    actions: {
        display: 'flex',
        gap: '8px',
    },
};
