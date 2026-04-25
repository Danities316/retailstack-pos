/**
 * ACK phase: acknowledge processed mutations to server.
 * Pure, testable module with no UI or SW logic.
 */

export interface AckRequest {
    idempotencyKeys: string[];
}

export interface AckResponse {
    acknowledged: true;
    acknowledgedKeys: string[]; // Server confirms which keys were processed
}

export interface AckPhaseResult {
    success: boolean;
    acknowledgedKeys: string[]; // Keys confirmed by server
    acknowledgedCount: number;
    error?: string;
}

/**
 * Execute ACK phase: tell server which mutations were processed.
 * Only removes items for keys explicitly acknowledged by server.
 */
export async function executeAckPhase(
    apiClient: any, // HTTP client
    idempotencyKeys: string[]
): Promise<AckPhaseResult> {
    if (!idempotencyKeys || idempotencyKeys.length === 0) {
        return {
            success: true,
            acknowledgedKeys: [],
            acknowledgedCount: 0,
        };
    }

    try {
        const response = await apiClient.post('/sync/ack', {
            idempotencyKeys,
        } as AckRequest);

        if (!response.success || !response.data.acknowledged) {
            return {
                success: false,
                acknowledgedKeys: [],
                acknowledgedCount: 0,
                error: response.error || 'Ack failed',
            };
        }

        // Extract acknowledged keys from server response
        const acknowledgedKeys = response.data.acknowledgedKeys || [];

        return {
            success: true,
            acknowledgedKeys,
            acknowledgedCount: acknowledgedKeys.length,
        };
    } catch (error: any) {
        return {
            success: false,
            acknowledgedKeys: [],
            acknowledgedCount: 0,
            error: error.message || 'Ack phase error',
        };
    }
}
