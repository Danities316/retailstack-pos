/**
 * Field-level conflict detection.
 * Compares baseVersion with current serverVersion.
 * Returns structured conflict marker without auto-resolution.
 */

import { ConflictDetectionRequest, ConflictDetectionResult, ConflictMarker, ConflictField } from './ConflictDTO';

export class ConflictDetector {
    /**
     * Detect conflicts between client mutation and server state.
     * @param serverEntity Current server entity
     * @param request Client mutation request
     * @returns Conflict detection result
     */
    static detectConflict(serverEntity: any, request: ConflictDetectionRequest): ConflictDetectionResult {
        // Check version mismatch
        if (!serverEntity) {
            // Entity doesn't exist on server (concurrent create)
            return {
                hasConflict: false,
                serverVersion: 0,
            };
        }

        const serverVersion = serverEntity.version || 0;

        // Version mismatch: client based work on stale version
        if (request.baseVersion !== serverVersion) {
            const conflictedFields = this.detectFieldConflicts(
                serverEntity.data,
                request.payload,
                request.baseVersion,
                serverVersion
            );

            const conflict: ConflictMarker = {
                entityId: request.entityId,
                entityType: request.entityType,
                baseVersion: request.baseVersion,
                clientVersion: request.clientVersion,
                serverVersion,
                conflictedFields,
                conflictType: conflictedFields.length > 0 ? 'FIELD_CONFLICT' : 'VERSION_MISMATCH',
                detectedAt: new Date().toISOString(),
            };

            return {
                hasConflict: true,
                conflict,
                serverVersion,
            };
        }

        return {
            hasConflict: false,
            serverVersion,
        };
    }

    /**
     * Detect which specific fields have conflicts.
     * @param serverData Current server data
     * @param clientData Client mutation data
     * @param baseVersion Version client was based on
     * @param serverVersion Current server version
     * @returns List of conflicted fields
     */
    private static detectFieldConflicts(
        serverData: any,
        clientData: any,
        baseVersion: number,
        serverVersion: number
    ): ConflictField[] {
        const conflicts: ConflictField[] = [];

        // Get all fields the client tried to change
        for (const fieldName in clientData) {
            const clientValue = clientData[fieldName];
            const serverValue = serverData[fieldName];

            // If server has a different value than what client expected
            if (serverValue !== clientValue) {
                conflicts.push({
                    fieldName,
                    clientValue,
                    serverValue,
                    baseValue: undefined, // Would need history to track this
                });
            }
        }

        return conflicts;
    }

    /**
     * Check if a delete is conflicted (e.g., already deleted or modified).
     */
    static detectDeleteConflict(serverEntity: any, baseVersion: number): ConflictDetectionResult {
        if (!serverEntity) {
            return {
                hasConflict: false,
                serverVersion: 0,
            };
        }

        if (serverEntity.version !== baseVersion) {
            const conflict: ConflictMarker = {
                entityId: serverEntity.id,
                entityType: serverEntity.type,
                baseVersion,
                clientVersion: baseVersion + 1,
                serverVersion: serverEntity.version,
                conflictedFields: [],
                conflictType: 'CONCURRENT_DELETE',
                detectedAt: new Date().toISOString(),
            };

            return {
                hasConflict: true,
                conflict,
                serverVersion: serverEntity.version,
            };
        }

        return {
            hasConflict: false,
            serverVersion: serverEntity.version,
        };
    }
}
