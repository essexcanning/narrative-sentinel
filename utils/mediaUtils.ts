/**
 * Fetches an image from a URL and converts it to a base64 string.
 * NOTE: This can be blocked by browser CORS policies for many websites. 
 * A robust production solution would involve a backend proxy to fetch the image data.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves to an object with base64 data and mimeType, or null on failure.
 */
export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch image (HTTP ${response.status}): ${url}`);
            return null;
        }
        const blob = await response.blob();
        const mimeType = blob.type;
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return { base64, mimeType };
    } catch (e) {
        console.warn(`CORS or network error fetching image. This is expected for cross-origin requests without a backend proxy. URL: ${url}`, e);
        return null;
    }
}
