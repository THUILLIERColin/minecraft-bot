import type { ServerState } from "./types.js";

/**
 * Contrat d'une source d'état serveur. Le monitor dépend de cette abstraction,
 * jamais d'une implémentation concrète : ping, RCON, Query ou mod sont
 * interchangeables sans toucher au reste du code.
 */
export interface StatusSource {
  fetch(): Promise<ServerState>;
}
