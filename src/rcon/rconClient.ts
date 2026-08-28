import { Socket } from "node:net";
import {
  decodePacket,
  encodePacket,
  PacketType,
  type RconPacket,
} from "./protocol.js";

export interface RconClientOptions {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
}

export class RconError extends Error {}
export class RconAuthError extends RconError {}

const DEFAULT_TIMEOUT_MS = 5000;
const AUTH_FAILED_ID = -1;

interface Waiter {
  resolve: (packet: RconPacket) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Client Source RCON. Les requêtes sont sérialisées : une seule est en vol à la
 * fois, corrélée à sa réponse par l'id du paquet. Ce choix suffit largement
 * pour du polling et supprime tout risque d'entrelacement des réponses.
 *
 * La reconnexion relève de l'appelant : ce client échoue franchement plutôt que
 * de masquer une panne réseau.
 */
export class RconClient {
  private socket: Socket | null = null;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private waiter: (Waiter & { id: number }) | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly timeoutMs: number;

  constructor(private readonly options: RconClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get connected(): boolean {
    return this.socket !== null;
  }

  async connect(): Promise<void> {
    if (this.socket !== null) return;

    const socket = await this.openSocket();
    this.attach(socket);

    const response = await this.request(PacketType.Auth, this.options.password);
    if (response.id === AUTH_FAILED_ID) {
      this.disconnect();
      throw new RconAuthError("authentification RCON refusée (mot de passe)");
    }
  }

  disconnect(): void {
    this.socket?.destroy();
    this.reset();
  }

  /**
   * Envoie une commande et résout avec sa réponse texte. Les appels concurrents
   * sont automatiquement sérialisés.
   */
  send(command: string): Promise<string> {
    const run = async (): Promise<string> => {
      if (this.socket === null) throw new RconError("client non connecté");
      const response = await this.request(PacketType.Command, command);
      return response.payload;
    };

    const result = this.chain.then(run, run);
    // La chaîne ne doit jamais rester rejetée, sinon elle bloque les suivantes.
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private openSocket(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      socket.setTimeout(this.timeoutMs);

      const fail = (error: Error): void => {
        socket.destroy();
        reject(new RconError(`connexion RCON échouée : ${error.message}`));
      };

      socket.once("error", fail);
      socket.once("timeout", () => fail(new Error("délai dépassé")));
      socket.connect(this.options.port, this.options.host, () => {
        socket.off("error", fail);
        socket.setTimeout(0);
        resolve(socket);
      });
    });
  }

  private attach(socket: Socket): void {
    this.socket = socket;
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("close", () => this.onClose());
    socket.on("error", () => this.onClose());
  }

  private request(type: number, payload: string): Promise<RconPacket> {
    return new Promise((resolve, reject) => {
      if (this.socket === null) {
        reject(new RconError("socket fermée"));
        return;
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new RconError("délai de réponse RCON dépassé"));
      }, this.timeoutMs);

      this.waiter = { id, resolve, reject, timer };
      this.socket.write(encodePacket({ id, type, payload }));
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (;;) {
      const decoded = decodePacket(this.buffer);
      if (decoded === null) break;
      this.buffer = this.buffer.subarray(decoded.bytesRead);
      this.resolveWaiter(decoded.packet);
    }
  }

  private resolveWaiter(packet: RconPacket): void {
    const waiter = this.waiter;
    if (waiter === null) return;
    clearTimeout(waiter.timer);
    this.waiter = null;
    waiter.resolve(packet);
  }

  private onClose(): void {
    const error = new RconError("connexion RCON fermée");
    if (this.waiter !== null) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(error);
    }
    this.reset();
  }

  private reset(): void {
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.waiter = null;
  }
}
