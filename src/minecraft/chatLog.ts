import { watch, type FSWatcher } from "node:fs";
import { open, stat } from "node:fs/promises";
import type { Logger } from "../logger/logger.js";

const CHAT_LINE = /^\[\d{2}:\d{2}:\d{2}\] \[[^\]]*\]: <([^>]+)> (.+)$/;

export interface ChatLine {
  player: string;
  message: string;
}

/**
 * Reconnaît une ligne de chat joueur (`<Pseudo> message`) dans la sortie
 * console standard (Paper/Spigot/Forge/NeoForge/vanilla partagent ce format).
 * Un message injecté par ChatBridge via `tellraw` ne matche jamais ce motif :
 * ce n'est pas un message de joueur, donc pas de boucle Discord -> MC -> Discord.
 */
export function parseChatLine(line: string): ChatLine | null {
  const match = CHAT_LINE.exec(line.trimEnd());
  if (match === null) return null;

  const player = match[1];
  const message = match[2];
  if (player === undefined || message === undefined) return null;

  return { player, message };
}

export type LineHandler = (line: string) => void;

/**
 * Suit un fichier de log en ne relisant que les octets ajoutés depuis la
 * dernière lecture. Si le fichier a rétréci, on repart de zéro : c'est le seul
 * cas de rotation à gérer, Minecraft régénérant `latest.log` à chaque
 * redémarrage plutôt que de le faire tourner en cours de partie.
 *
 * `check()` est exposée publiquement pour être appelée directement dans les
 * tests, qui évitent ainsi la latence et les flakys de fs.watch.
 */
export class LogTailer {
  private position = 0;
  private buffer = "";
  private watcher: FSWatcher | null = null;
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly logger: Logger,
    private readonly onLine: LineHandler,
  ) {}

  async start(): Promise<void> {
    this.position = await this.currentSize();
    this.watcher = watch(this.path, () => {
      this.pending = this.pending.then(() => this.check());
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  async check(): Promise<void> {
    const size = await this.currentSize();
    if (size < this.position) {
      this.position = 0;
      this.buffer = "";
    }
    if (size <= this.position) return;

    const length = size - this.position;
    const data = Buffer.alloc(length);
    const handle = await open(this.path, "r");
    try {
      await handle.read(data, 0, length, this.position);
    } finally {
      await handle.close();
    }

    this.position = size;
    this.buffer += data.toString("utf8");

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      this.onLine(line);
    }
  }

  private async currentSize(): Promise<number> {
    try {
      return (await stat(this.path)).size;
    } catch (error) {
      this.logger.warn("lecture de la taille du fichier de log échouée", {
        error,
      });
      return this.position;
    }
  }
}
