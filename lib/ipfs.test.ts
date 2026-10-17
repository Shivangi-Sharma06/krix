import { describe, it, expect } from 'vitest';
import { sniffImageMimeType, isValidIpfsCidFormat } from './ipfs';

describe('IPFS Security & Validation (lib/ipfs.ts)', () => {
  it('detects JPEG from magic bytes', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const blob = new Blob([jpegBytes], { type: 'application/octet-stream' });
    const mime = await sniffImageMimeType(blob);
    expect(mime).toBe('image/jpeg');
  });

  it('detects PNG from magic bytes', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const blob = new Blob([pngBytes], { type: 'application/octet-stream' });
    const mime = await sniffImageMimeType(blob);
    expect(mime).toBe('image/png');
  });

  it('rejects executable/text files masquerading as images', async () => {
    const textBytes = new TextEncoder().encode('<html><body>not an image</body></html>');
    const blob = new Blob([textBytes], { type: 'image/jpeg' }); // fake mime
    const mime = await sniffImageMimeType(blob);
    expect(mime).toBeNull();
  });

  it('validates IPFS CID formats', () => {
    expect(isValidIpfsCidFormat('QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco')).toBe(true);
    expect(isValidIpfsCidFormat('bafybeicgqom2h6r7yrtz6g4a33tewxupk2c27bkjffvhjklmno3pqr4stv')).toBe(true);
    expect(isValidIpfsCidFormat('invalid_cid_12345')).toBe(false);
    expect(isValidIpfsCidFormat('')).toBe(false);
  });
});
