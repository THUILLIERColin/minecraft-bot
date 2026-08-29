# mc-monitor

Bot Discord de monitoring pour un serveur Minecraft. Compatible avec tous les
loaders (Fabric, Forge, NeoForge, Paper, vanilla) car il ne s'appuie que sur des
canaux universels : le ping public et le protocole RCON.

Fonctions actuelles :

- renommer une catégorie Discord selon l'état du serveur (`🟢 Minecraft` / `🔴 Minecraft`) ;
- annoncer les connexions et déconnexions de joueurs dans un salon dédié ;
- relayer un salon Discord vers le tchat global du serveur, dans les deux sens
  (voir `ChatBridge` ci-dessous pour le détail des deux mécanismes utilisés).

La base est prête à recevoir la modération et le TPS (accès RCON déjà en place),
puis la configuration via Discord (prévue au palier suivant).

## Principe d'architecture

Le cœur (`monitor`) ne connaît ni Minecraft ni Discord. Il interroge une source
abstraite (`StatusSource`) et émet des événements typés ; Minecraft et Discord
sont branchés aux extrémités et remplaçables sans toucher au centre.

```
config/    Chargement et validation de l'environnement (Zod, fail-fast).
logger/    Journalisation structurée.

rcon/
  protocol.ts    Encodage/décodage des paquets Source RCON (pur, 0 dépendance).
  rconClient.ts  Connexion TCP, authentification, requêtes sérialisées.

minecraft/
  types.ts         ServerState.
  statusSource.ts  Interface StatusSource (le contrat).
  pingProbe.ts     Sonde de disponibilité (online/offline) par ping.
  parsers.ts       Parsing pur des sorties `list` et TPS.
  rconSource.ts    Source principale : ping pour l'état, RCON pour les joueurs.
  chatLog.ts       Parsing pur des lignes de chat + suivi de `latest.log`.

monitor/
  events.ts   Types d'événements.
  diff.ts     Calcul pur des changements entre deux états.
  monitor.ts  Boucle de polling auto-réordonnancée, résiliente aux erreurs.

discord/
  client.ts            Connexion et cycle de vie discord.js.
  categoryPresence.ts  Renomme la catégorie.
  playerFeed.ts        Poste les messages de connexion/déconnexion.
  chatBridge.ts        Relais bidirectionnel Discord <-> Minecraft (RCON et LogTailer).

main.ts    Assemble les composants et démarre.
```

Répartition des canaux : le **ping** tranche vite l'état online/offline sans
ouvrir de connexion coûteuse ; le **RCON** ne sert que si le serveur répond, pour
lire la liste fiable des joueurs et exécuter des commandes. Chacun son rôle.

## Pourquoi un RCON maison

Le protocole Source RCON est petit et figé. Les bibliothèques npm existantes sont
soit non maintenues, soit orientées Deno. Un module interne (~150 lignes, zéro
dépendance) est ici plus robuste et durable qu'une dépendance fragile, et il est
testé au byte près.

## Configuration

Copier `.env.example` vers `.env` et renseigner les valeurs. Les identifiants
Discord s'obtiennent en activant le mode développeur, puis clic droit > Copier
l'identifiant.

| Variable                  | Rôle                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `DISCORD_TOKEN`           | Token du bot.                                                               |
| `DISCORD_CATEGORY_ID`     | Catégorie à renommer.                                                       |
| `DISCORD_FEED_CHANNEL_ID` | Salon des connexions/déconnexions.                                          |
| `DISCORD_CHAT_CHANNEL_ID` | Salon relayé vers le tchat du serveur.                                      |
| `MC_LOG_PATH`             | Chemin vers `latest.log` (optionnel, active le relais Minecraft → Discord). |
| `MC_HOST`                 | Adresse du serveur.                                                         |
| `MC_PORT`                 | Port de jeu (ping). Défaut 25565.                                           |
| `RCON_PORT`               | Port RCON alloué dans le panel. Défaut 25575.                               |
| `RCON_PASSWORD`           | Mot de passe RCON (long et aléatoire).                                      |
| `POLL_INTERVAL_SECONDS`   | Intervalle d'interrogation. Défaut 15.                                      |

### Côté serveur Minecraft

Dans `server.properties` : `enable-rcon=true`, `rcon.port=<port alloué>`,
`rcon.password=<mot de passe>`. Le port RCON doit être alloué dans le panel de
l'hébergeur pour être joignable de l'extérieur.

### Permissions du bot Discord

Sur la catégorie et les salons visés : voir le salon, gérer les salons (pour
renommer la catégorie), envoyer des messages, lire l'historique des messages.

Le relais de chat nécessite l'intent privilégié **Message Content**, à activer
dans le Discord Developer Portal (onglet Bot) : sans ça, la connexion échoue.

### Comment fonctionne le relais de chat dans les deux sens

RCON est un protocole requête/réponse : il ne peut pas pousser les messages
tapés en jeu vers le bot, il ne fait que répondre aux commandes qu'on lui
envoie. Les deux sens n'utilisent donc pas le même mécanisme :

- **Discord → Minecraft** : RCON, via `tellraw` (`ChatBridge.handleMessage`).
- **Minecraft → Discord** : le bot lit lui-même `logs/latest.log` en continu
  (`LogTailer` + `parseChatLine`), seul canal universel (tous loaders) à
  exposer le chat des joueurs.

Cette deuxième moitié suppose que le bot puisse lire ce fichier, donc qu'il
tourne **sur la même machine** que le serveur Minecraft (ou avec un accès
réseau au fichier). Concrètement : monter le dossier de logs du serveur en
lecture seule dans le conteneur du bot, et renseigner `MC_LOG_PATH` avec le
chemin vu depuis le conteneur. Sans `MC_LOG_PATH`, cette moitié du relais est
simplement désactivée — le reste du bot fonctionne normalement, y compris le
sens Discord → Minecraft.

Aucune boucle possible : un `tellraw` injecté ne produit pas la forme
`<Pseudo> message` d'un vrai message de joueur (donc jamais relayé vers
Discord), et un message posté par le bot dans Discord vient d'un compte bot
(donc ignoré par `ChatBridge` côté Discord → Minecraft).

## Développement

```
cp .env.example .env
npm install
npm run dev
```

Qualité (tout doit passer avant un commit) :

```
npm run check     # format + lint + typecheck + tests
```

Chaque brique testable l'est : protocole RCON, client RCON (contre un faux
serveur), parsers, logique de diff, et `chatLog` (contre un vrai fichier
temporaire, écrit et tronqué pendant le test).

## Déploiement (Coolify sur Raspberry Pi)

1. Pousser le dépôt sur Git.
2. Coolify : nouvelle application pointant vers le dépôt ; le `Dockerfile` est
   détecté automatiquement (image multi-arch, compatible ARM).
3. Renseigner les variables d'environnement dans Coolify (jamais de `.env`
   commité).
4. Déployer.

Si le relais Minecraft → Discord est activé (`MC_LOG_PATH`), le bot doit
tourner sur la même machine que le serveur Minecraft, avec le dossier de logs
du serveur monté en lecture seule dans son conteneur (ex. un volume Docker
partagé, ou un bind mount vers le chemin réel sur l'hôte).

## Extensions prévues

- **Modération** (kick/ban/whitelist) : `RconSource.command()` est déjà là.
- **TPS** : `parseTps` gère Paper et Forge/NeoForge ; commande à rendre
  configurable par serveur.
- **Configuration via Discord** : commandes slash + persistance, sans réécriture
  du cœur (la config deviendra une source parmi d'autres).
- **Multi-serveurs** : l'architecture par instances le permet ; il suffira
  d'instancier un Monitor par serveur.
