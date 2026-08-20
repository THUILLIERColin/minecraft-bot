// mcstatus.ts
// -----------------------------------------------------------------------------
// Ce fichier a UN SEUL rôle : demander l'état du serveur Minecraft.
// Il ne connaît rien à Discord. C'est volontaire : on garde chaque brique
// séparée pour pouvoir la tester et la remplacer sans casser le reste.
// -----------------------------------------------------------------------------

import { pingJava } from "@minescope/mineping";

// On décrit la "forme" du résultat qu'on renvoie au reste du programme.
// `online` : est-ce que le serveur a répondu ?
// `players` : la liste des noms de joueurs (vide si offline ou si le serveur
//             ne renvoie pas les noms).
export interface ServerState {
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  players: string[]; // noms des joueurs connectés
}

// Interroge le serveur une fois et renvoie son état.
// Si le serveur ne répond pas (éteint, injoignable...), on renvoie online:false
// au lieu de planter. C'est important : un serveur down est un état NORMAL
// qu'on veut détecter, pas une erreur qui casse le bot.
export async function fetchServerState(
  host: string,
  port: number,
): Promise<ServerState> {
  try {
    // pingJava fait le "Server List Ping" : le meme protocole que ton client
    // Minecraft utilise pour afficher le serveur dans sa liste.
    const result = await pingJava(host, { port, timeout: 5000 });

    // `result.players.sample` est la liste (parfois absente) des noms.
    // On la transforme en simple tableau de chaines. Si elle est absente,
    // on met un tableau vide.
    const sample = result.players?.sample ?? [];
    const players = sample.map((p) => p.name);

    return {
      online: true,
      playerCount: result.players?.online ?? 0,
      maxPlayers: result.players?.max ?? 0,
      players,
    };
  } catch {
    // Toute erreur (timeout, connexion refusee...) = serveur considere offline.
    return {
      online: false,
      playerCount: 0,
      maxPlayers: 0,
      players: [],
    };
  }
}
