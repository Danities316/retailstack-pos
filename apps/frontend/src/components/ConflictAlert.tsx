import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export interface ConflictAlertProps {
    conflictCount: number;
    onResolve: () => void;
    onDismiss: () => void;
}

/**
 * ConflictAlert: Shows when sync detects conflicts that need manual attention
 * Displayed as a banner in dashboard with action buttons
 */
export function ConflictAlert({ conflictCount, onResolve, onDismiss }: ConflictAlertProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible || conflictCount === 0) {
        return null;
    }

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss();
    };

    return (
        <div className="fixed top-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-lg shadow-md">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-100">
                        {conflictCount} Sync {conflictCount === 1 ? 'Conflict' : 'Conflicts'}
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">
                        {conflictCount === 1
                            ? 'An item was modified both locally and on the server.'
                            : `${conflictCount} items were modified both locally and on the server.`}

                        {' '}Please review and resolve these conflicts.
                    </p>

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={onResolve}
                            className="px-3 py-1.5 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors duration-200"
                        >
                            Resolve Now
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 text-sm font-medium bg-yellow-200 hover:bg-yellow-300 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-900 dark:text-yellow-100 rounded transition-colors duration-200"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
                    title="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

export default ConflictAlert;
