import type { ServerState } from "./types.js";

/**
 * Contrat d'une source d'état serveur. Le monitor dépend de cette abstraction,
 * jamais d'une implémentation concrète : on peut ainsi passer du ping au RCON,
 * à la Query ou à un mod sans toucher au reste du code.
 */
export interface StatusSource {
  fetch(): Promise<ServerState>;
}
