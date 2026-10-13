import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Runtime } from '../core/runtime.js';
import { Store, type Data } from './db.js';

/** Store persisté dans un fichier JSON (serveur Node uniquement). */
export function createFileStore(file: string, runtime: Runtime): Store {
  const initial = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<Data>) : undefined;
  return new Store({ uuid: runtime.uuid, initial, persist: (data) => writeFileSync(file, JSON.stringify(data, null, 2)) });
}
