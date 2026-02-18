/**
 * Feature flags for offline-first implementation.
 * Control rollout and enable/disable features safely.
 */

export interface FeatureFlags {
    // Offline functionality
    OFFLINE_MODE_ENABLED: boolean;
    AUTO_SYNC_ENABLED: boolean;
    SYNC_INTERVAL_MS: number;

    // Conflict handling
    MANUAL_CONFLICT_RESOLUTION: boolean;
    SHOW_CONFLICT_INDICATORS: boolean;

    // Service Worker
    SERVICE_WORKER_ENABLED: boolean;
    WORKBOX_DEBUGGING: boolean;

    // Database
    INDEXEDDB_ENABLED: boolean;
    DB_VERSION: number;

    // UI
    SHOW_SYNC_STATUS: boolean;
    SHOW_PENDING_MUTATIONS: boolean;
    SHOW_DEBUG_INFO: boolean;
}

/**
 * Default feature flags (conservative defaults for production).
 */
const DEFAULT_FLAGS: FeatureFlags = {
    // Offline: disabled by default, must opt-in
    OFFLINE_MODE_ENABLED: false,
    AUTO_SYNC_ENABLED: false,
    SYNC_INTERVAL_MS: 30000,

    // Conflict: always manual, always visible (safety first)
    MANUAL_CONFLICT_RESOLUTION: true,
    SHOW_CONFLICT_INDICATORS: true,

    // Service Worker: enabled by default
    SERVICE_WORKER_ENABLED: true,
    WORKBOX_DEBUGGING: false,

    // Database: enabled by default
    INDEXEDDB_ENABLED: true,
    DB_VERSION: 1,

    // UI: disabled by default
    SHOW_SYNC_STATUS: false,
    SHOW_PENDING_MUTATIONS: false,
    SHOW_DEBUG_INFO: false,
};

/**
 * Environment-specific overrides.
 */
const ENVIRONMENT_OVERRIDES: Record<string, Partial<FeatureFlags>> = {
    development: {
        OFFLINE_MODE_ENABLED: true,
        AUTO_SYNC_ENABLED: true,
        SHOW_SYNC_STATUS: true,
        SHOW_PENDING_MUTATIONS: true,
        SHOW_DEBUG_INFO: true,
        WORKBOX_DEBUGGING: true,
    },
    production: {
        OFFLINE_MODE_ENABLED: true,
        AUTO_SYNC_ENABLED: true,
        SHOW_SYNC_STATUS: true,
        WORKBOX_DEBUGGING: false,
    },
    staging: {
        OFFLINE_MODE_ENABLED: true,
        AUTO_SYNC_ENABLED: true,
        SHOW_SYNC_STATUS: true,
        SHOW_PENDING_MUTATIONS: true,
        SHOW_DEBUG_INFO: true,
    },
};

/**
 * Initialize feature flags from environment and overrides.
 */
function getFeatureFlags(): FeatureFlags {
    const env = import.meta.env.MODE || 'development';
    const overrides = ENVIRONMENT_OVERRIDES[env] || {};

    return {
        ...DEFAULT_FLAGS,
        ...overrides,
        // Allow runtime overrides from localStorage (dev only)
        ...(env === 'development' ? getLocalStorageOverrides() : {}),
    };
}

/**
 * Get overrides from localStorage (dev debugging).
 */
function getLocalStorageOverrides(): Partial<FeatureFlags> {
    try {
        const stored = localStorage.getItem('FEATURE_FLAGS_OVERRIDES');
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

/**
 * Global feature flags instance.
 */
export const featureFlags = getFeatureFlags();

/**
 * Helper: Check if feature is enabled.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    const value = featureFlags[flag];
    return typeof value === 'boolean' ? value : false;
}

/**
 * Helper: Get feature config value.
 */
export function getFeatureConfig<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
    return featureFlags[flag];
}

/**
 * Helper: Override feature at runtime (dev only).
 */
export function setFeatureOverride(flag: keyof FeatureFlags, value: any): void {
    if (import.meta.env.MODE !== 'development') {
        console.warn('Feature overrides only available in development');
        return;
    }

    (featureFlags as any)[flag] = value;
    const overrides = getLocalStorageOverrides();
    overrides[flag] = value;
    localStorage.setItem('FEATURE_FLAGS_OVERRIDES', JSON.stringify(overrides));
    console.log(`Feature flag ${flag} set to ${value}`);
}
