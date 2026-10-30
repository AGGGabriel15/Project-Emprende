import * as ExpoCrypto from 'expo-crypto';

/**
 * Hermes no trae WebCrypto. Sin él, supabase-js generaba el código PKCE del
 * login con Google con Math.random() y lo mandaba sin SHA-256 ("plain"), con el
 * aviso "WebCrypto API is not supported". Esto le da azar seguro y SHA-256
 * nativos de expo-crypto. Se importa antes de crear el cliente de Supabase.
 */
type CryptoLike = {
  getRandomValues?: typeof ExpoCrypto.getRandomValues;
  randomUUID?: () => string;
  subtle?: { digest: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: CryptoLike };
const crypto: CryptoLike = g.crypto ?? {};

crypto.getRandomValues ??= ExpoCrypto.getRandomValues;
crypto.randomUUID ??= ExpoCrypto.randomUUID;
crypto.subtle ??= {
  digest: (algorithm, data) => {
    const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
    if (name !== 'SHA-256') throw new Error(`Algoritmo no soportado: ${name}`);
    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
  },
};

g.crypto = crypto;
