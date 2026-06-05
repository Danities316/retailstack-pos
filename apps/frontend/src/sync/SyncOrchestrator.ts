/**
 * Sync Orchestrator: centralize and control all sync behavior.
 * Execution order: PULL → Apply → PUSH → Conflict → ACK
 * Pure, testable module with no UI or SW logic.
 */

import { executePullPhase, PullPhaseResult } from './PullPhase';
import { executePushPhase, PushPhaseResult } from './PushPhase';
import { executeConflictHandler, ConflictHandlerResult } from './ConflictHandler';
import { executeAckPhase, AckPhaseResult } from './AckPhase';
import { globalSyncQueue, SyncQueueItem } from '../offline/SyncQueue';

export interface SyncOrchestrationResult {
    success: boolean;
    startedAt: string;
    completedAt: string;
    phases: {
        pull: PullPhaseResult;
        push?: PushPhaseResult;
        conflict?: ConflictHandlerResult;
        ack?: AckPhaseResult;
    };
    error?: string;
}

export class SyncOrchestrator {
    private issyncing = false;

    /**
     * Execute complete sync cycle: PULL → PUSH → CONFLICT → ACK
     */
    async executeSyncCycle(
        apiClient: any, // HTTP client
        db: IDBDatabase,
        lastSyncTime?: string
    ): Promise<SyncOrchestrationResult> {
        if (this.issyncing) {
            return {
                success: false,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                phases: {
                    pull: {
                        success: false,
                        serverTime: new Date().toISOString(),
                        changesApplied: 0,
                        error: 'Sync already in progress',
                    },
                },
                error: 'Sync already in progress',
            };
        }

        this.issyncing = true;
        const startedAt = new Date().toISOString();
        const phases: any = {};

        try {
            // PHASE 1: PULL server changes
            const pullResult = await executePullPhase(apiClient, db, globalSyncQueue, lastSyncTime);
            phases.pull = pullResult;

            if (!pullResult.success) {
                throw new Error(`Pull phase failed: ${pullResult.error}`);
            }

            // PHASE 2: PUSH local mutations
            const queuedItems = globalSyncQueue.getPending();
            const pushResult = await executePushPhase(apiClient, queuedItems);
            phases.push = pushResult;

            // PHASE 3: CONFLICT detection
            if (pushResult.conflicts > 0) {
                const conflictResult = await executeConflictHandler(db, pushResult as any);
                phases.conflict = conflictResult;
            }

            // PHASE 4: ACK processed mutations
            const ackResult = await executeAckPhase(apiClient, queuedItems.map((item) => item.idempotencyKey));
            phases.ack = ackResult;
            console.log('ACK Result:', ackResult);

            // Clean up ONLY acknowledged items from queue (if ACK succeeded)
            if (ackResult.success && ackResult.acknowledgedKeys.length > 0) {
                for (const key of ackResult.acknowledgedKeys) {
                    globalSyncQueue.remove(key);
                }
            } else if (!ackResult.success) {
                console.warn('ACK phase failed, queue items retained for retry:', ackResult.error);
            } else if (ackResult.acknowledgedKeys.length < queuedItems.length) {
                console.warn(
                    `Partial ACK: ${ackResult.acknowledgedKeys.length}/${queuedItems.length} items acknowledged. ` +
                    `Keeping unacknowledged items in queue for retry.`
                );
                // Remove only the acknowledged ones
                for (const key of ackResult.acknowledgedKeys) {
                    globalSyncQueue.remove(key);
                }
            }

            return {
                success: true,
                startedAt,
                completedAt: new Date().toISOString(),
                phases,
            };
        } catch (error: any) {
            return {
                success: false,
                startedAt,
                completedAt: new Date().toISOString(),
                phases,
                error: error.message || 'Sync orchestration failed',
            };
        } finally {
            this.issyncing = false;
        }
    }

    /**
     * Check if sync is in progress.
     */
    isSync(): boolean {
        return this.issyncing;
    }

    /**
     * Get pending queue items (for inspection).
     */
    getPendingItems(): SyncQueueItem[] {
        return globalSyncQueue.getPending();
    }

    /**
     * Get all queue items (for debugging).
     */
    getAllQueueItems(): SyncQueueItem[] {
        return globalSyncQueue.getAll();
    }
}

/**
 * Global singleton orchestrator instance.
 */
export const globalSyncOrchestrator = new SyncOrchestrator();
