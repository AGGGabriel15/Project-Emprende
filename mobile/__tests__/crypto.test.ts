/// <reference types="jest" />
/**
 * El polyfill debe dar a supabase-js lo que necesita para PKCE con SHA-256.
 */
jest.mock('expo-crypto', () => {
  const { createHash, randomFillSync, randomUUID } = jest.requireActual('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomValues: (array: Uint8Array) => randomFillSync(array),
    randomUUID,
    digest: async (_: string, data: ArrayBuffer | Uint8Array) => {
      const bytes: Uint8Array = createHash('sha256').update(new Uint8Array(data as ArrayBuffer)).digest();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
});

describe('WebCrypto para el login con Google', () => {
  it('ofrece azar seguro y SHA-256', async () => {
    const g = globalThis as unknown as { crypto?: unknown };
    delete g.crypto;
    require('~/lib/crypto-polyfill');
    const crypto = g.crypto as { getRandomValues: (a: Uint32Array) => Uint32Array; subtle: { digest: (a: string, d: Uint8Array) => Promise<ArrayBuffer> } };
    expect(crypto.getRandomValues(new Uint32Array(4)).some((n) => n > 0)).toBe(true);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc')));
    expect(Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
