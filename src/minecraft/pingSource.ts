import { pingJava } from "@minescope/mineping";
import type { StatusSource } from "./statusSource.js";
import { OFFLINE_STATE, type ServerState } from "./types.js";

const PING_TIMEOUT_MS = 5000;

export interface PingSourceOptions {
  host: string;
  port: number;
}

/**
 * Source basée sur le Server List Ping. La liste de joueurs provient du champ
 * `sample`, que le serveur peut tronquer ou omettre : la détection par pseudo
 * est donc best-effort, pas garantie.
 */
export class PingSource implements StatusSource {
  constructor(private readonly options: PingSourceOptions) {}

  async fetch(): Promise<ServerState> {
    try {
      const response = await pingJava(this.options.host, {
        port: this.options.port,
        timeout: PING_TIMEOUT_MS,
      });

      const sample = response.players?.sample ?? [];

      return {
        online: true,
        playerCount: response.players?.online ?? 0,
        maxPlayers: response.players?.max ?? 0,
        players: sample.map((player) => player.name),
      };
    } catch {
      return OFFLINE_STATE;
    }
  }
}
