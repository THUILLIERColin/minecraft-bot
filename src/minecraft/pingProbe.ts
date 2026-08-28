import { pingJava } from "@minescope/mineping";

const PING_TIMEOUT_MS = 5000;

export interface PingProbeOptions {
  host: string;
  port: number;
}

/**
 * Sonde de disponibilité légère. Sert uniquement à savoir si le serveur répond,
 * sans ouvrir de connexion RCON : c'est plus rapide et cela évite de tenter une
 * authentification coûteuse quand le serveur est éteint.
 */
export class PingProbe {
  constructor(private readonly options: PingProbeOptions) {}

  async isOnline(): Promise<boolean> {
    try {
      await pingJava(this.options.host, {
        port: this.options.port,
        timeout: PING_TIMEOUT_MS,
      });
      return true;
    } catch {
      return false;
    }
  }
}
