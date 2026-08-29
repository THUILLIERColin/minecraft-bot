import type { Client, Message } from "discord.js";
import type { Logger } from "../logger/logger.js";

const MAX_MESSAGE_LENGTH = 200;

/**
 * Exécute une commande sur le serveur Minecraft. RconSource la satisfait déjà :
 * ChatBridge ne dépend que de ce contrat, jamais de RCON directement.
 */
export interface CommandExecutor {
  command(command: string): Promise<string>;
}

/**
 * Construit la commande `tellraw` diffusant un message Discord en jeu, ou
 * `null` si rien n'est à envoyer (message vide après nettoyage).
 *
 * Le texte passe par JSON.stringify plutôt que par une concaténation de
 * chaînes : c'est ce qui échappe guillemets/backslashes et empêche un message
 * Discord malveillant d'injecter des commandes dans le tellraw.
 */
export function buildTellrawCommand(
  username: string,
  content: string,
): string | null {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;

  const truncated =
    cleaned.length > MAX_MESSAGE_LENGTH
      ? `${cleaned.slice(0, MAX_MESSAGE_LENGTH)}…`
      : cleaned;

  const payload = [
    { text: "[Discord] ", color: "aqua" },
    { text: `${username}: `, bold: true },
    { text: truncated },
  ];

  return `tellraw @a ${JSON.stringify(payload)}`;
}

/**
 * Relaie les messages d'un salon Discord vers le tchat global du serveur.
 * Sens Discord -> Minecraft uniquement : RCON ne peut pas pousser d'événements,
 * il n'existe donc pas de sens inverse universel (tous loaders) sans dépendance
 * supplémentaire (accès SSH aux logs, ou plugin/mod par loader).
 */
export class ChatBridge {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly executor: CommandExecutor,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.client.on("messageCreate", (message: Message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.channelId !== this.channelId) return;
    if (message.author.bot) return;

    const command = buildTellrawCommand(
      message.author.username,
      message.cleanContent,
    );
    if (command === null) return;

    try {
      await this.executor.command(command);
    } catch (error) {
      this.logger.error("relais de message vers le serveur échoué", {
        error,
      });
    }
  }
}
