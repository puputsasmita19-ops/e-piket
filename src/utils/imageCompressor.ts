/**
 * Ultra-efficient client-side Image Compressor for e-Piket Digital
 * Automatically compresses profile photos, selfie attendance, and incident evidence
 * to high-quality lightweight formats (~40KB - 120KB) saving 90%+ storage while preserving clarity.
 */

export interface CompressionResult {
  dataUrl: string;
  blob: Blob;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  savingsPercentage: number;
  width: number;
  height: number;
}

export interface CompressOptions {
  maxDimension?: number; // e.g. 600 for avatars, 1280 for incident/documents
  quality?: number; // 0.75 - 0.85
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Compresses an image File, Blob, or base64 Data URL.
 */
export const compressImageAuto = async (
  input: File | Blob | string,
  options: CompressOptions = {}
): Promise<CompressionResult> => {
  const maxDimension = options.maxDimension || 1024;
  const quality = options.quality ?? 0.8;
  const outputMime = options.mimeType || 'image/jpeg';

  return new Promise((resolve, reject) => {
    let originalSizeBytes = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleDataUrl = (dataUrl: string) => {
      // Calculate original size approx from base64 if input was string
      if (!originalSizeBytes) {
        const base64Str = dataUrl.split(',')[1] || dataUrl;
        originalSizeBytes = Math.round((base64Str.length * 3) / 4);
      }

      img.onload = () => {
        let { width, height } = img;

        // Scale down if exceeding maxDimension
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw background white for transparent PNGs converted to JPEG
        if (outputMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              const fallbackUrl = canvas.toDataURL(outputMime, quality);
              const compressedSize = Math.round((fallbackUrl.length * 3) / 4);
              const savings = Math.max(0, Math.round(((originalSizeBytes - compressedSize) / (originalSizeBytes || 1)) * 100));

              resolve({
                dataUrl: fallbackUrl,
                blob: new Blob([fallbackUrl], { type: outputMime }),
                originalSizeBytes,
                compressedSizeBytes: compressedSize,
                originalSizeFormatted: formatFileSize(originalSizeBytes),
                compressedSizeFormatted: formatFileSize(compressedSize),
                savingsPercentage: savings,
                width,
                height
              });
              return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const finalDataUrl = reader.result as string;
              const compressedSize = blob.size;
              const savings = Math.max(0, Math.round(((originalSizeBytes - compressedSize) / (originalSizeBytes || 1)) * 100));

              resolve({
                dataUrl: finalDataUrl,
                blob,
                originalSizeBytes,
                compressedSizeBytes: compressedSize,
                originalSizeFormatted: formatFileSize(originalSizeBytes),
                compressedSizeFormatted: formatFileSize(compressedSize),
                savingsPercentage: savings,
                width,
                height
              });
            };
          },
          outputMime,
          quality
        );
      };

      img.onerror = (e) => reject(new Error(`Failed to load image for compression: ${e}`));
      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        handleDataUrl(input);
      } else {
        // Assume url or path
        const base64Str = input;
        originalSizeBytes = base64Str.length;
        handleDataUrl(input);
      }
    } else {
      originalSizeBytes = input.size;
      const reader = new FileReader();
      reader.onload = (e) => {
        handleDataUrl(e.target?.result as string);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(input);
    }
  });
};
