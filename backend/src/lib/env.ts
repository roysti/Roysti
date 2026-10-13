/**
 * Petites abstractions d'environnement pour que la logique métier tourne
 * aussi bien dans Node (serveur) que dans Hermes (application Android).
 */

/** Variable d'environnement si le moteur en fournit (Node), sinon undefined (React Native). */
export function env(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

/** Équivalent de AbortSignal.timeout(ms), absent de certains moteurs (Hermes). */
export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
