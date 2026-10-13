import { z } from 'zod';

// Doit être évalué AVANT la création des schémas du backend partagé :
// on désactive la génération de code de zod (new Function), dont la
// disponibilité n'est pas garantie sous Hermes. Le parseur classique est utilisé.
z.config({ jitless: true });
