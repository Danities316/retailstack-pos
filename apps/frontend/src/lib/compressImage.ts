/**
 * compressImage
 *
 * Resizes and compresses an image File to a base64 JPEG string.
 * Max dimension: 800px on the longest side.
 * JPEG quality: 0.72 — good visual quality, typically 60–90kb output.
 *
 * Why canvas compression instead of just increasing the server limit?
 * - A raw phone photo is 3–8MB. Even with a 5mb server limit, uncompressed
 *   photos will still 413. Compression fixes it at the source.
 * - Smaller base64 strings = faster IndexedDB reads offline.
 * - Receipts and product cards never need full-resolution images.
 */
export async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const MAX_DIMENSION = 800;
        const QUALITY = 0.72;

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            // Calculate new dimensions, preserving aspect ratio
            let { width, height } = img;
            if (width > height) {
                if (width > MAX_DIMENSION) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                }
            } else {
                if (height > MAX_DIMENSION) {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context unavailable'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG — always smaller than PNG for photos
            const compressed = canvas.toDataURL('image/jpeg', QUALITY);
            resolve(compressed);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image for compression'));
        };

        img.src = objectUrl;
    });
}