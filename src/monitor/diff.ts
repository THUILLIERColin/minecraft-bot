import type { MonitorEvent } from "../events.js";
import type { ServerState } from "../minecraft/types.js";

/**
 * Compare deux états successifs et en déduit les événements. Fonction pure :
 * mêmes entrées, mêmes sorties, aucun effet de bord — donc trivialement testable.
 */
export function diffStates(
  previous: ServerState,
  current: ServerState,
): MonitorEvent[] {
  const events: MonitorEvent[] = [];

  if (current.online && !previous.online) {
    events.push({
      type: "serverWentOnline",
      playerCount: current.playerCount,
      maxPlayers: current.maxPlayers,
    });
  }

  if (!current.online && previous.online) {
    events.push({ type: "serverWentOffline" });
  }

  // Les changements de population n'ont de sens que si le serveur était et
  // reste en ligne : on évite d'émettre de faux départs quand il s'éteint.
  if (previous.online && current.online) {
    for (const name of current.players) {
      if (!previous.players.includes(name)) {
        events.push({ type: "playerJoined", name });
      }
    }
    for (const name of previous.players) {
      if (!current.players.includes(name)) {
        events.push({ type: "playerLeft", name });
      }
    }
  }

  return events;
}
