import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Runtime } from './runtime.js';

export const nodeRuntime: Runtime = {
  uuid: () => randomUUID(),
  randomHex: (bytes) => randomBytes(bytes).toString('hex'),
  hashPassword: (password, salt) => scryptSync(password, salt, 64).toString('hex'),
  safeEqual: (a, b) => {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  },
  sha256Hex: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
};
