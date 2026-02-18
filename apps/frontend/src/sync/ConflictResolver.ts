/**
 * Deterministic conflict resolution per entity type.
 * Rules:
 * - Never silently drop financial or inventory data
 * - Preserve user intent when possible
 * - Pure functions, no side effects
 */

export type ResolutionStrategy = 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE' | 'MANUAL';

export interface ResolutionRule {
    entityType: string;
    strategy: ResolutionStrategy;
    preserveFields: string[]; // Fields to always keep from client
    criticalFields: string[]; // Fields that trigger MANUAL resolution
}

/**
 * Default resolution rules per entity type.
 * Critical fields (e.g., financial data) never auto-resolve.
 */
const DEFAULT_RESOLUTION_RULES: ResolutionRule[] = [
    {
        entityType: 'product',
        strategy: 'SERVER_WINS',
        preserveFields: [],
        criticalFields: ['price', 'cost', 'sku'],
    },
    {
        entityType: 'sale',
        strategy: 'MANUAL',
        preserveFields: ['items', 'totalAmount', 'paymentMethod'],
        criticalFields: ['totalAmount', 'itemCount', 'tenantId'],
    },
    {
        entityType: 'inventory',
        strategy: 'MERGE',
        preserveFields: ['quantity'],
        criticalFields: ['quantity', 'tenantId'],
    },
    {
        entityType: 'category',
        strategy: 'SERVER_WINS',
        preserveFields: [],
        criticalFields: ['name'],
    },
];

export class ConflictResolver {
    /**
     * Resolve a conflict based on entity type and resolution rules.
     */
    static resolve(
        entityType: string,
        clientData: any,
        serverData: any,
        clientVersion: number,
        serverVersion: number,
        conflictedFields: any[] = []
    ): { resolved: any; strategy: ResolutionStrategy; requiresManualReview: boolean } {
        const rule = this.getRuleForEntity(entityType);

        // Check if conflict involves critical fields
        const hasCriticalConflict = conflictedFields.some((field) =>
            rule.criticalFields.includes(field.fieldName)
        );

        if (hasCriticalConflict || rule.strategy === 'MANUAL') {
            return {
                resolved: serverData, // Keep server version; UI will show conflict indicator
                strategy: 'MANUAL',
                requiresManualReview: true,
            };
        }

        let resolved: any;

        switch (rule.strategy) {
            case 'CLIENT_WINS':
                resolved = this.clientWins(clientData, serverData, rule.preserveFields);
                break;
            case 'SERVER_WINS':
                resolved = this.serverWins(clientData, serverData, rule.preserveFields);
                break;
            case 'MERGE':
                resolved = this.merge(clientData, serverData, rule.preserveFields);
                break;

        }

    /**
     * Client wins: client changes override server, but preserve designated fields.
     */
    private static clientWins(clientData: any, serverData: any, preserveFields: string[]): any {
        const resolved = { ...clientData };

        for (const field of preserveFields) {
            if (serverData.hasOwnProperty(field)) {
                resolved[field] = serverData[field];
            }
        }

        return resolved;
    }

    /**
     * Server wins: server data is authoritative, except for preserved fields.
     */
    private static serverWins(clientData: any, serverData: any, preserveFields: string[]): any {
        const resolved = { ...serverData };

        for (const field of preserveFields) {
            if (clientData.hasOwnProperty(field)) {
                resolved[field] = clientData[field];
            }
        }

        return resolved;
    }

    /**
     * Merge: simple field-level merge (client adds, server values win for overlaps).
     */
    private static merge(clientData: any, serverData: any, _preserveFields: string[]): any {
        const resolved = { ...serverData };

        // Add new fields from client that don't exist on server
        for (const field in clientData) {
            if (!serverData.hasOwnProperty(field)) {
                resolved[field] = clientData[field];
            }
        }

        return resolved;
    }

    /**
     * Get resolution rule for entity type, with default fallback.
     */
    private static getRuleForEntity(entityType: string): ResolutionRule {
        const rule = DEFAULT_RESOLUTION_RULES.find((r) => r.entityType === entityType);

        return (
            rule || {
                entityType,
                strategy: 'SERVER_WINS',
                preserveFields: [],
                criticalFields: [],
            }
        );
    }

    /**
     * Register or override a resolution rule.
     */
    static registerRule(rule: ResolutionRule): void {
        const existingIndex = DEFAULT_RESOLUTION_RULES.findIndex((r) => r.entityType === rule.entityType);

        if (existingIndex >= 0) {
            DEFAULT_RESOLUTION_RULES[existingIndex] = rule;
        } else {
            DEFAULT_RESOLUTION_RULES.push(rule);
        }
    }
}
