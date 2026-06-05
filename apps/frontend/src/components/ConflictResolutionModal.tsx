import { X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export interface ConflictData {
    entityId: string;
    entityType: string;
    description: string;
    clientData: Record<string, any>;
    serverData: Record<string, any>;
    criticalFields: string[];
}

export interface ConflictResolutionModalProps {
    isOpen: boolean;
    conflict: ConflictData | null;
    onResolution: (entityId: string, resolution: 'CLIENT' | 'SERVER' | 'CUSTOM', customData?: Record<string, any>) => void;
    onCancel: () => void;
}

/**
 * ConflictResolutionModal: Shows detailed conflict and lets user pick resolution
 * Supports three strategies: use client version, use server version, or custom merge
 */
export function ConflictResolutionModal({
    isOpen,
    conflict,
    onResolution,
    onCancel,
}: ConflictResolutionModalProps) {
    const [resolution, setResolution] = useState<'CLIENT' | 'SERVER' | 'CUSTOM'>('SERVER');
    const [customData, setCustomData] = useState<Record<string, any>>({});

    if (!isOpen || !conflict) {
        return null;
    }

    const handleResolve = () => {
        onResolution(
            conflict.entityId,
            resolution,
            resolution === 'CUSTOM' ? customData : undefined
        );
        setResolution('SERVER');
        setCustomData({});
    };

    const handleCustomFieldChange = (field: string, value: any) => {
        setCustomData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Resolve Conflict
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {conflict.description}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Critical Fields Warning */}
                    {conflict.criticalFields.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                            <p className="text-sm font-medium text-red-800 dark:text-red-100">
                                ⚠️ Critical fields involved: {conflict.criticalFields.join(', ')}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-200 mt-1">
                                These fields significantly affect your business. Choose carefully.
                            </p>
                        </div>
                    )}

                    {/* Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Client Version */}
                        <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                                Your Version (Client)
                            </h3>
                            <div className="space-y-2 text-sm">
                                {Object.entries(conflict.clientData).map(([key, value]) => (
                                    <div key={key} className="flex justify-between gap-2">
                                        <span className="text-gray-600 dark:text-gray-400 font-medium">{key}:</span>
                                        <span className="text-gray-900 dark:text-white text-right break-words">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <label className="mt-4 flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="resolution"
                                    value="CLIENT"
                                    checked={resolution === 'CLIENT'}
                                    onChange={() => setResolution('CLIENT')}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Keep my version
                                </span>
                            </label>
                        </div>

                        {/* Server Version */}
                        <div className="border border-green-200 dark:border-green-700 rounded-lg p-4">
                            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                                Server Version
                            </h3>
                            <div className="space-y-2 text-sm">
                                {Object.entries(conflict.serverData).map(([key, value]) => (
                                    <div key={key} className="flex justify-between gap-2">
                                        <span className="text-gray-600 dark:text-gray-400 font-medium">{key}:</span>
                                        <span className="text-gray-900 dark:text-white text-right break-words">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <label className="mt-4 flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="resolution"
                                    value="SERVER"
                                    checked={resolution === 'SERVER'}
                                    onChange={() => setResolution('SERVER')}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Use server version
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Custom Resolution */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input
                                type="radio"
                                name="resolution"
                                value="CUSTOM"
                                checked={resolution === 'CUSTOM'}
                                onChange={() => setResolution('CUSTOM')}
                                className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Custom merge (edit fields below)
                            </span>
                        </label>

                        {resolution === 'CUSTOM' && (
                            <div className="space-y-3 mt-3 pl-6 border-l-2 border-gray-300 dark:border-gray-600">
                                {Object.keys(conflict.clientData).map((key) => (
                                    <div key={key}>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                            {key}
                                        </label>
                                        <input
                                            type="text"
                                            value={customData[key] ?? conflict.serverData[key] ?? ''}
                                            onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder={`${key}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleResolve}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Resolve Conflict
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConflictResolutionModal;
