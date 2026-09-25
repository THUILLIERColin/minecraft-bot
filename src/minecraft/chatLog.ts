import { open, type FileHandle } from "node:fs/promises";
import type { Logger } from "../logger/logger.js";

const CHAT_LINE =
  /^\[[^\]]+\] \[[^\]]+\](?: \[[^\]]+\])?: (?:\[Not Secure\] )?<([^>]+)> (.+)$/;

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

export interface LogTailerOptions {
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;

/**
 * Suit un fichier de log en ne relisant que les octets ajoutés depuis la
 * dernière lecture.
 *
 * Au redémarrage, Minecraft renomme `latest.log` et en crée un neuf. D'où deux
 * choix : un polling par chemin plutôt que `fs.watch`, qui reste accroché à
 * l'inode de l'ancien fichier et devient muet ; et un changement d'inode
 * traité comme un nouveau fichier, la taille seule ne suffisant pas si le
 * nouveau dépasse déjà l'ancienne position.
 *
 * Le polling appelle `check()` directement plutôt que de passer par
 * `watchFile` : ce dernier compare contre son propre instantané, pris de façon
 * asynchrone, et peut rater une écriture survenue juste après `start()`. Ici,
 * la seule référence est la position lue par la classe elle-même.
 *
 * `check()` est exposée publiquement pour être appelée directement dans les
 * tests, sans attendre le cycle de polling.
 */
export class LogTailer {
  private position = 0;
  private inode: number | null = null;
  private buffer = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<void> = Promise.resolve();
  private readonly intervalMs: number;

  constructor(
    private readonly path: string,
    private readonly logger: Logger,
    private readonly onLine: LineHandler,
    options: LogTailerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  async start(): Promise<void> {
    const handle = await this.openIfPresent();
    if (handle === null) {
      this.logger.warn("fichier de log absent, en attente de sa création", {
        path: this.path,
      });
    } else {
      try {
        const stats = await handle.stat();
        if (!stats.isFile()) {
          throw new Error(
            `${this.path} n'est pas un fichier : MC_LOG_PATH doit désigner latest.log, pas son dossier`,
          );
        }
        this.position = stats.size;
        this.inode = stats.ino;
      } finally {
        await handle.close();
      }
    }

    this.timer = setInterval(this.tick, this.intervalMs);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async check(): Promise<void> {
    const handle = await this.openIfPresent();
    if (handle === null) return;

    try {
      const { size, ino } = await handle.stat();
      if (ino !== this.inode || size < this.position) {
        this.inode = ino;
        this.position = 0;
        this.buffer = "";
      }
      if (size <= this.position) return;

      const length = size - this.position;
      const data = Buffer.alloc(length);
      await handle.read(data, 0, length, this.position);
      this.position = size;
      this.buffer += data.toString("utf8");
    } finally {
      await handle.close();
    }

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      this.onLine(line);
    }
  }

  private readonly tick = (): void => {
    // Sans ce catch, une erreur de lecture rejetterait la chaîne sans
    // gestionnaire et Node arrêterait tout le processus.
    this.pending = this.pending
      .then(() => this.check())
      .catch((error: unknown) => {
        this.logger.error("lecture du fichier de log échouée", {
          path: this.path,
          error,
        });
      });
  };

  /** Fichier absent = rotation en cours ou serveur jamais démarré : pas une erreur. */
  private async openIfPresent(): Promise<FileHandle | null> {
    try {
      return await open(this.path, "r");
    } catch (error) {
      if (isFileNotFound(error)) return null;
      throw error;
    }
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
