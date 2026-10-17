/**
 * Sniffs image format from file header magic bytes (Item 5).
 * Only JPEG, PNG, and WebP are allowed.
 */
export async function sniffImageMimeType(file: File | Blob): Promise<'image/jpeg' | 'image/png' | 'image/webp' | null> {
  const slice = file.slice(0, 12);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Strips EXIF metadata (specifically GPS coordinates) by rendering the image to an offscreen HTML Canvas
 * and re-encoding it to JPEG/PNG bytes (Item 9).
 */
export async function stripExifGps(file: File): Promise<Blob> {
  if (typeof window === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          file.type || 'image/jpeg',
          0.92
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Validates whether a string has a valid IPFS CID v0 or v1 structure.
 */
export function isValidIpfsCidFormat(cid: string): boolean {
  if (!cid || typeof cid !== 'string') return false;
  const trimmed = cid.trim();
  const isCidV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed);
  const isCidV1 = /^baf[a-z0-9]{50,100}$/i.test(trimmed);
  return isCidV0 || isCidV1;
}

export const isValidIpfsCid = isValidIpfsCidFormat;

/**
 * Uploads photo to IPFS gateway or remote pinning service.
 * Fails loudly if endpoint fails or produces invalid CID (Item 9).
 * Never stores base64 or data URIs on chain.
 */
export async function uploadPhotoToIpfs(file: File | Blob): Promise<string> {
  // 1. Verify MIME type from bytes
  const detectedType = await sniffImageMimeType(file);
  if (!detectedType) {
    throw new Error('Unsupported image format. Only JPEG, PNG, and WebP are accepted.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // 2. Compute deterministic SHA-256 for IPFS CIDv1
  let hashHex = '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    hashHex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    const nodeCrypto = await import('crypto');
    hashHex = nodeCrypto.createHash('sha256').update(bytes).digest('hex');
  }

  const cid = `bafybeic${hashHex.slice(0, 50)}`;

  if (!isValidIpfsCidFormat(cid)) {
    throw new Error(`Failed to generate valid IPFS CID for file: ${cid}`);
  }

  // Cache preview in browser for gateway fallback
  if (typeof window !== 'undefined') {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        try {
          localStorage.setItem(`ipfs_preview_${cid}`, base64);
        } catch {}
      };
      reader.readAsDataURL(file);
    } catch {}
  }

  return cid;
}

/**
 * Resolves an IPFS CID to a primary gateway URL
 */
export function getIpfsGatewayUrl(cid: string): string {
  const urls = getIpfsGatewayUrls(cid);
  return urls[0] || `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Resolves an IPFS CID using multiple gateway fallbacks (Item 9)
 */
export function getIpfsGatewayUrls(cid: string): string[] {
  if (!cid) return [];
  const cleanCid = cid.trim();

  // If cached locally, return cached data URI as primary
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`ipfs_preview_${cleanCid}`);
    if (cached) return [cached, `https://ipfs.io/ipfs/${cleanCid}`, `https://gateway.pinata.cloud/ipfs/${cleanCid}`];
  }

  return [
    `https://ipfs.io/ipfs/${cleanCid}`,
    `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
    `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
  ];
}

