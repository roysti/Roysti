// Configuration Metro : embarque la logique métier partagée de ../backend/src
// pour que l'application fonctionne hors ligne, sans serveur.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../backend/src');

const config = getDefaultConfig(projectRoot);

// Metro ne voit par défaut que le dossier du projet.
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];

const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (context.originModulePath.startsWith(sharedRoot + path.sep)) {
    // Le backend utilise des imports TypeScript de style NodeNext (« ./foo.js » pour foo.ts).
    if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    // Les dépendances (zod…) sont résolues depuis les node_modules de l'application,
    // jamais depuis ../backend/node_modules (absent lors des builds CI).
    if (!moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
      return resolve({ ...context, originModulePath: path.join(projectRoot, 'package.json') }, moduleName, platform);
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
