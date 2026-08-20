# mc-monitor — Palier 0

Bot de monitoring Minecraft. Pour l'instant : affiche dans le terminal l'état
du serveur (en ligne / hors ligne) et les connexions / déconnexions de joueurs.
Aucune dépendance à Discord pour le moment — c'est la brique de base.

## Comment lancer

1. Copie `.env.example` en `.env` et mets l'adresse de ton serveur :
   ```
   cp .env.example .env
   ```
   Puis édite `.env` (MC_HOST, MC_PORT).

2. Installe les dépendances :
   ```
   npm install
   ```

3. Lance en mode développement (redémarre tout seul quand tu modifies le code) :
   ```
   npm run dev
   ```

Tu devrais voir défiler l'état du serveur. Connecte-toi/déconnecte-toi du jeu
pour voir apparaître les messages.

## Fichiers

- `src/mcstatus.ts` — interroge le serveur Minecraft (ping). Ne connaît rien à Discord.
- `src/index.ts` — la boucle : ping toutes les X secondes, compare, affiche les changements.

## Prochaine étape (Palier 1)

Remplacer les `console.log` de `src/index.ts` par de vrais messages Discord :
changer le nom d'une catégorie selon l'état, et poster les connexions/déconnexions
dans un salon.
