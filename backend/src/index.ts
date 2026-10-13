import { createApp } from './app.js';
import { config } from './config.js';

const { app, provider } = createApp();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API Roysti sur http://localhost:${config.port}/api (fournisseur : ${provider.name}${provider.isDemo ? ', données de démo' : ''})`);
  if (config.demoMode) console.log('Compte démo : demo@roysti.app / demo1234');
});
