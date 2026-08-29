# CLAUDE.md — mc-monitor

Contexte permanent du projet pour Claude Code. Garde ce fichier court : il est
lu à chaque session. Les détails d'implémentation vivent dans le code et le
README, pas ici.

## Ce qu'est le projet

Bot Discord de monitoring pour un serveur Minecraft. Deux fonctions en
production : renommer une catégorie Discord selon l'état du serveur
(`🟢 Minecraft` / `🔴 Minecraft`) et annoncer les connexions/déconnexions de
joueurs dans un salon dédié. Compatible tous loaders (Fabric, Forge, NeoForge,
Paper, vanilla) car il ne dépend que de canaux universels : ping public et RCON.

Stack : TypeScript strict, Node ≥ 20, ESM. Discord.js v14. Zod pour la
validation. Vitest pour les tests. Déploiement Docker sur Raspberry Pi via
Coolify.

## Principe d'architecture — à respecter absolument

Le cœur ne connaît ni Minecraft ni Discord. Le flux est :

```
StatusSource (interface)  ->  Monitor  ->  événements typés  ->  couche Discord
```

- `Monitor` interroge une `StatusSource` abstraite et émet des événements. Il
  ne référence jamais Discord ni un protocole Minecraft concret.
- Les implémentations (ping, RCON) sont branchées aux extrémités et
  interchangeables. Ajouter une source = écrire une classe qui implémente
  `StatusSource`, sans toucher au cœur.
- La logique métier pure (diff d'états, parsing) est isolée dans des fonctions
  sans I/O, donc testable directement.

Quand tu ajoutes une feature, tu ORCHESTRES ces briques, tu ne les réécris pas.
Si une tâche semble exiger de modifier `Monitor`, `diff` ou le protocole RCON,
signale-le et explique pourquoi avant de le faire.

## Carte du code

```
src/config/    Chargement + validation d'env (Zod, fail-fast).
src/logger/    Journalisation structurée.
src/rcon/      protocol.ts (paquets Source RCON, pur) + rconClient.ts (TCP, auth).
src/minecraft/ types, StatusSource, pingProbe, parsers (purs), rconSource.
src/monitor/   events, diff (pur), monitor (boucle de polling résiliente).
src/discord/   client, categoryPresence, playerFeed.
src/main.ts    Assemble tout et démarre.
test/          Tests Vitest (protocole, client RCON, parsers, diff).
```

## Conventions de code

- TypeScript strict. Le code doit passer `npm run check` sans erreur ni warning.
  CI (GitHub Actions, `.github/workflows/ci.yml`) rejoue format/lint/typecheck/test
  sur chaque push et PR vers `main` — un push qui casse `check` casse la CI.
- Nommage : `camelCase` (variables/fonctions), `PascalCase` (types/classes),
  `SCREAMING_SNAKE_CASE` (constantes d'environnement).
- Commentaires rares, réservés au « pourquoi » non évident. Jamais de commentaire
  qui paraphrase le code.
- Un fichier = une responsabilité. Séparation stricte des couches.
- Pas de SQL ni d'appel réseau dispersé : tout accès externe passe par une
  couche/classe dédiée exposant une interface typée.
- Pas de dépendance non maintenue ou dépréciée. En cas de doute sur une lib,
  proposer et justifier avant de l'ajouter. Le RCON est volontairement maison
  (protocole simple et figé) : ne pas le remplacer par une lib.
- Erreurs : échouer franchement et loguer avec contexte. Ne jamais masquer une
  panne réseau derrière un état par défaut silencieux, sauf cas explicitement
  voulu (serveur injoignable = offline, qui est un état normal).

## Tests

- Toute fonction pure nouvelle (parsing, diff, validation) doit avoir des tests.
- Le protocole et le client RCON sont testés contre un faux serveur TCP local,
  pas mockés. Garde cette approche pour tout nouveau composant réseau testable.
- Ne teste pas l'API Discord elle-même.
- Les tests existants ne doivent jamais régresser.

## Secrets et configuration

- Les secrets (`DISCORD_TOKEN`, `RCON_PASSWORD`) restent dans l'environnement,
  jamais commités, jamais exposés dans une réponse Discord ou un log.
- `.env` n'est jamais commité. Toute nouvelle variable est ajoutée à
  `.env.example` et documentée dans le README.

## Méthode de travail attendue

1. Avant de coder une tâche non triviale : lire les fichiers concernés, résumer
   ta compréhension et proposer un plan. Attendre validation.
2. Implémenter par petits incréments, en lançant `npm run check` régulièrement.
3. Terminer par un récapitulatif : fichiers créés/modifiés, comment tester,
   points restants (ex. config Coolify).
4. Signaler toute ambiguïté ou décision structurante au lieu de deviner.

## Hors périmètre sauf demande explicite

Modération, TPS, relais de chat, dashboard web, multi-token. L'architecture les
anticipe (`RconSource.command()` existe déjà, `parseTps` gère Paper et
Forge/NeoForge, le modèle de données est pensé multi-serveurs), mais ne les
implémente pas sans qu'on te le demande.