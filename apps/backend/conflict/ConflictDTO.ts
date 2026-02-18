/**
 * Data Transfer Objects for conflict detection.
 * No business logic, pure data structures.
 */

export interface ConflictField {
    fieldName: string;
    clientValue: any;
    serverValue: any;
    baseValue: any;
}

export interface ConflictMarker {
    entityId: string;
    entityType: string;
    baseVersion: number;
    clientVersion: number;
    serverVersion: number;
    conflictedFields: ConflictField[];
    conflictType: 'VERSION_MISMATCH' | 'FIELD_CONFLICT' | 'CONCURRENT_DELETE';
    detectedAt: string; // ISO 8601
}

export interface ConflictDetectionRequest {
    entityId: string;
    entityType: string;
    baseVersion: number;
    clientVersion: number;
    payload: any;
}

export interface ConflictDetectionResult {
    hasConflict: boolean;
    conflict?: ConflictMarker;
    serverVersion: number;
}
