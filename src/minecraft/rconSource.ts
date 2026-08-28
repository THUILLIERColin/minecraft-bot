import type { StatusSource } from "./statusSource.js";
import { OFFLINE_STATE, type ServerState } from "./types.js";
import { parsePlayerList } from "./parsers.js";
import { PingProbe } from "./pingProbe.js";
import { RconClient } from "../rcon/rconClient.js";
import type { Logger } from "../logger/logger.js";

export interface RconSourceOptions {
  host: string;
  rconPort: number;
  rconPassword: string;
  pingPort: number;
  logger: Logger;
}

/**
 * Source principale. Répartition des rôles :
 *   - le ping tranche rapidement online/offline (pas de coût si le serveur dort) ;
 *   - RCON, seulement si le serveur répond, fournit la liste fiable des joueurs.
 *
 * La connexion RCON est ouverte paresseusement et réutilisée tant qu'elle tient ;
 * toute erreur la ferme pour forcer une reconnexion propre au cycle suivant.
 */
export class RconSource implements StatusSource {
  private readonly probe: PingProbe;
  private readonly rcon: RconClient;

  constructor(private readonly options: RconSourceOptions) {
    this.probe = new PingProbe({ host: options.host, port: options.pingPort });
    this.rcon = new RconClient({
      host: options.host,
      port: options.rconPort,
      password: options.rconPassword,
    });
  }

  async fetch(): Promise<ServerState> {
    const online = await this.probe.isOnline();
    if (!online) {
      this.rcon.disconnect();
      return OFFLINE_STATE;
    }

    try {
      const output = await this.query("list");
      const parsed = parsePlayerList(output);
      return {
        online: true,
        playerCount: parsed.online,
        maxPlayers: parsed.max,
        players: parsed.players,
      };
    } catch (error) {
      this.options.logger.warn("lecture RCON échouée, serveur vu en ligne", {
        error,
      });
      this.rcon.disconnect();
      // Le serveur répond au ping mais RCON a échoué : on le considère en ligne
      // sans liste de joueurs plutôt que de mentir sur son état.
      return { online: true, playerCount: 0, maxPlayers: 0, players: [] };
    }
  }

  /** Exécute une commande arbitraire (modération, TPS…) en réutilisant la connexion. */
  async command(command: string): Promise<string> {
    return this.query(command);
  }

  private async query(command: string): Promise<string> {
    if (!this.rcon.connected) {
      await this.rcon.connect();
    }
    return this.rcon.send(command);
  }
}
