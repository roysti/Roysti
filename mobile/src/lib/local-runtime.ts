import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import { constantTimeEqual, type Runtime } from '../../../backend/src/core/runtime';

/**
 * Services cryptographiques de l'application (mode hors ligne) :
 * aléa natif via expo-crypto, empreinte PBKDF2-SHA256 en JavaScript pur (synchrone).
 */
export const mobileRuntime: Runtime = {
  uuid: () => Crypto.randomUUID(),
  randomHex: (bytes) => bytesToHex(Crypto.getRandomBytes(bytes)),
  hashPassword: (password, salt) => bytesToHex(pbkdf2(sha256, password, salt, { c: 10_000, dkLen: 32 })),
  safeEqual: constantTimeEqual,
};
