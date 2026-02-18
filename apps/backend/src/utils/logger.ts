/**
 * Simple logging utility for the application
 */

export const logger = {
    info: (message: string, data?: any) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
    },

    error: (message: string, data?: any) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, data ? data : '');
    },

    warn: (message: string, data?: any) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? data : '');
    },

    debug: (message: string, data?: any) => {
        if (process.env.DEBUG) {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ? data : '');
        }
    },
};
