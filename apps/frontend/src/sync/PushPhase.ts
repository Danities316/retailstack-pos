/**
 * PUSH phase: send local mutations to server.
 * Pure, testable module with no UI or SW logic.
 */

import { SyncQueueItem } from '../offline/SyncQueue';

export interface Mutation {
    idempotencyKey: string;
    entityId: string;
    entityType: string;
    mutationType: string;
    baseVersion: number;
    clientVersion: number;
    payload: any;
}

export interface PushResponse {
    results: MutationResult[];
}

export interface MutationResult {
    idempotencyKey: string;
    success: boolean;
    serverVersion?: number;
    conflict?: boolean;
    error?: string;
}

export interface PushPhaseResult {
    success: boolean;
    pushed: number;
    succeeded: number;
    failed: number;
    conflicts: number;
    error?: string;
}

/**
 * Execute PUSH phase: send queued mutations to server.
 */
export async function executePushPhase(
    apiClient: any, // HTTP client
    queueItems: SyncQueueItem[]
): Promise<PushPhaseResult> {
    if (!queueItems || queueItems.length === 0) {
        return {
            success: true,
            pushed: 0,
            succeeded: 0,
            failed: 0,
            conflicts: 0,
        };
    }

    try {
        // Convert queue items to mutations
        const mutations: Mutation[] = queueItems.map((item) => ({
            idempotencyKey: item.idempotencyKey,
            entityId: item.entityId,
            entityType: item.entityType,
            mutationType: item.mutationType,
            baseVersion: item.baseVersion,
            clientVersion: item.clientVersion,
            payload: item.payload,
        }));

        // Send to server
        const response = await apiClient.post('/sync/push', {
            mutations,
        });

        if (!response.success) {
            return {
                success: false,
                pushed: queueItems.length,
                succeeded: 0,
                failed: queueItems.length,
                conflicts: 0,
                error: response.error || 'Push failed',
            };
        }

        // Process results
        const results: MutationResult[] = response.data.results || [];
        let succeeded = 0;
        let failed = 0;
        let conflicts = 0;

        for (const result of results) {
            if (result.success) {
                succeeded++;
            } else if (result.conflict) {
                conflicts++;
            } else {
                failed++;
            }
        }

        return {
            success: true,
            pushed: queueItems.length,
            succeeded,
            failed,
            conflicts,
        };
    } catch (error: any) {
        return {
            success: false,
            pushed: queueItems.length,
            succeeded: 0,
            failed: queueItems.length,
            conflicts: 0,
            error: error.message || 'Push phase error',
        };
    }
}
