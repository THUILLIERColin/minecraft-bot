# mc-monitor

Bot Discord de monitoring pour un serveur Minecraft. Deux fonctions :

- renommer une catégorie Discord selon l'état du serveur (`🟢 Minecraft` / `🔴 Minecraft`) ;
- poster les connexions et déconnexions de joueurs dans un salon dédié.

## Architecture

Le principe : le cœur (`monitor`) ne connaît ni Minecraft ni Discord. Il
interroge une source abstraite et émet des événements ; Minecraft et Discord
sont branchés aux extrémités et remplaçables sans toucher au centre.

```
config.ts     Lit et valide l'environnement (fail-fast au démarrage).
logger.ts     Journalisation structurée.
events.ts     Types d'événements (langage commun monitor <-> Discord).
main.ts       Assemble les composants et démarre.

minecraft/
  types.ts         ServerState.
  statusSource.ts  Interface StatusSource (le contrat).
  pingSource.ts    Implémentation via Server List Ping.

monitor/
  diff.ts     Calcul pur des changements entre deux états (testable, sans I/O).
  monitor.ts  Boucle de polling ; émet les événements.

discord/
  client.ts            Connexion et cycle de vie discord.js.
  categoryPresence.ts  Renomme la catégorie.
  playerFeed.ts        Poste les messages de connexion/déconnexion.
```

Pour changer de source (RCON, Query, mod), il suffit d'écrire une nouvelle
classe implémentant `StatusSource` et de la brancher dans `main.ts`.

## Configuration

Copier `.env.example` vers `.env` et renseigner les valeurs. Les trois
identifiants Discord s'obtiennent en activant le mode développeur dans Discord,
puis clic droit > Copier l'identifiant.

| Variable                  | Rôle                                          |
| ------------------------- | --------------------------------------------- |
| `DISCORD_TOKEN`           | Token du bot (portail développeur Discord).   |
| `DISCORD_CATEGORY_ID`     | Catégorie à renommer.                          |
| `DISCORD_FEED_CHANNEL_ID` | Salon des messages connexion/déconnexion.      |
| `MC_HOST` / `MC_PORT`     | Adresse du serveur Minecraft.                  |
| `POLL_INTERVAL_SECONDS`   | Intervalle entre deux interrogations (défaut 15). |

## Permissions du bot

Le bot a besoin, sur la catégorie et le salon visés, de : voir le salon, gérer
les salons (pour renommer la catégorie), envoyer des messages. Aucun intent
privilégié n'est requis.

## Lancer en local

```
cp .env.example .env
npm install
npm run dev
```

## Déploiement (Coolify sur Raspberry Pi)

1. Pousser le dépôt sur Git.
2. Coolify : nouvelle application pointant vers le dépôt ; le `Dockerfile` est
   détecté automatiquement.
3. Renseigner les variables d'environnement dans Coolify (pas de `.env` commité).
4. Déployer.

## Limite connue

La liste des joueurs provient du champ `sample` du ping, que le serveur peut
tronquer au-delà d'un certain nombre de joueurs ou omettre selon sa config. La
détection par pseudo est donc best-effort. Pour une fiabilité totale, brancher
une source Query ou RCON (voir Architecture).
