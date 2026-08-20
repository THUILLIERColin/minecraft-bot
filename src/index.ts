// index.ts
// -----------------------------------------------------------------------------
// Le programme principal. Il tourne en boucle : il interroge le serveur toutes
// les X secondes, compare avec l'etat precedent, et affiche ce qui a change.
//
// PALIER 0 : pour l'instant tout s'affiche dans le TERMINAL. Aucune ligne de
// Discord ici. Une fois que tu vois ces messages defiler correctement, on
// remplacera les `console.log` par des vrais messages Discord au Palier 1.
// -----------------------------------------------------------------------------

import "dotenv/config"; // charge le fichier .env dans process.env
import { fetchServerState, type ServerState } from "./mcstatus.js";

// --- Lecture de la configuration (avec valeurs par defaut) -------------------
const HOST = process.env.MC_HOST ?? "localhost";
const PORT = Number(process.env.MC_PORT ?? "25565");
const INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS ?? "15");

// --- Memoire : le dernier etat connu -----------------------------------------
// On garde en memoire le resultat du ping precedent pour pouvoir comparer.
// `null` signifie "on n'a encore jamais interroge le serveur".
let previous: ServerState | null = null;

// Compare deux listes de joueurs et renvoie qui est arrive et qui est parti.
function diffPlayers(before: string[], after: string[]) {
  const joined = after.filter((name) => !before.includes(name));
  const left = before.filter((name) => !after.includes(name));
  return { joined, left };
}

// Fait UN cycle : ping + comparaison + affichage.
async function tick() {
  const current = await fetchServerState(HOST, PORT);

  // Premier passage : on ne compare pas, on affiche juste l'etat initial.
  if (previous === null) {
    console.log(
      current.online
        ? `[demarrage] Serveur EN LIGNE (${current.playerCount}/${current.maxPlayers})`
        : `[demarrage] Serveur HORS LIGNE`,
    );
    previous = current;
    return;
  }

  // --- Changement d'etat online <-> offline ----------------------------------
  if (current.online !== previous.online) {
    if (current.online) {
      console.log("🟢 Le serveur vient de passer EN LIGNE");
    } else {
      console.log("🔴 Le serveur vient de passer HORS LIGNE");
    }
  }

  // --- Connexions / deconnexions ---------------------------------------------
  // On ne regarde les joueurs que si le serveur est en ligne maintenant ET
  // l'etait avant (sinon les "departs" au moment ou le serveur s'eteint
  // pollueraient l'affichage).
  if (current.online && previous.online) {
    const { joined, left } = diffPlayers(previous.players, current.players);
    for (const name of joined) {
      console.log(`➡️  ${name} s'est connecté`);
    }
    for (const name of left) {
      console.log(`⬅️  ${name} s'est déconnecté`);
    }
  }

  // On memorise l'etat actuel pour la prochaine comparaison.
  previous = current;
}

// --- Boucle principale -------------------------------------------------------
async function main() {
  console.log(
    `Monitoring de ${HOST}:${PORT} toutes les ${INTERVAL_SECONDS}s. Ctrl+C pour arreter.`,
  );

  // On fait un premier tick tout de suite, puis on repete a l'intervalle voulu.
  await tick();
  setInterval(tick, INTERVAL_SECONDS * 1000);
}

main();
