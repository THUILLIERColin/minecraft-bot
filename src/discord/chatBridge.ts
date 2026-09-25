import {
  PermissionFlagsBits,
  type Client,
  type Message,
  type PermissionsBitField,
} from "discord.js";
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
 * Un `tellraw` réussi ne renvoie rien ; toute réponse est donc un refus du
 * serveur (aucun joueur connecté, erreur de syntaxe…) qu'il faut remonter,
 * RCON ne distinguant pas lui-même succès et échec d'une commande.
 */
export function tellrawFailure(response: string): string | null {
  const trimmed = response.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const REQUIRED_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, label: "Voir le salon" },
  { flag: PermissionFlagsBits.SendMessages, label: "Envoyer des messages" },
] as const;

/**
 * Sans « Voir le salon », Discord n'envoie tout simplement pas les messages du
 * salon au bot : aucune erreur, juste du silence. D'où cette vérification
 * explicite au démarrage.
 */
export function missingChatPermissions(
  permissions: Readonly<PermissionsBitField>,
): string[] {
  return REQUIRED_PERMISSIONS.filter(({ flag }) => !permissions.has(flag)).map(
    ({ label }) => label,
  );
}

/**
 * Relaie un salon Discord vers le tchat global du serveur, dans les deux sens.
 *
 * Discord -> Minecraft : écoute `messageCreate` et exécute `tellraw` via RCON.
 * Minecraft -> Discord : alimentée en externe (voir `relayFromMinecraft`) par
 * un `LogTailer` qui tail `logs/latest.log`, seul canal universel (tous
 * loaders) capable de voir passer le chat, RCON étant requête/réponse.
 *
 * Pas de boucle possible : un message posté par `relayFromMinecraft` vient du
 * bot lui-même, donc `author.bot` est vrai et `handleMessage` l'ignore déjà.
 */
export class ChatBridge {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly executor: CommandExecutor,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.client.on("messageCreate", (message: Message) => {
      void this.handleMessage(message);
    });
    await this.verifyChannelAccess();
  }

  async relayFromMinecraft(player: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel === null || !channel.isSendable()) {
        this.logger.error("salon de chat introuvable ou non textuel", {
          channelId: this.channelId,
        });
        return;
      }
      await channel.send(`**${player}**: ${message}`);
    } catch (error) {
      this.logger.error("relais de message vers Discord échoué", { error });
    }
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
      const failure = tellrawFailure(await this.executor.command(command));
      if (failure !== null) {
        this.logger.warn("tellraw refusé par le serveur", {
          response: failure,
        });
        return;
      }
      this.logger.info("message Discord relayé vers Minecraft", {
        author: message.author.username,
      });
    } catch (error) {
      this.logger.error("relais de message vers le serveur échoué", {
        error,
      });
    }
  }

  /**
   * N'interrompt pas le démarrage : un salon mal configuré ne doit couper que
   * le relais, pas le monitoring. Mais il doit se voir dans les logs.
   */
  private async verifyChannelAccess(): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel === null || channel.isDMBased() || !channel.isTextBased()) {
        this.logger.error("salon de chat introuvable ou non textuel", {
          channelId: this.channelId,
        });
        return;
      }

      const me = channel.guild.members.me;
      if (me === null) {
        this.logger.warn("permissions du bot non vérifiables (membre absent)", {
          channelId: this.channelId,
        });
        return;
      }

      const missing = missingChatPermissions(channel.permissionsFor(me));
      if (missing.length > 0) {
        this.logger.error("permissions manquantes sur le salon de chat", {
          channelId: this.channelId,
          missing,
        });
      }
    } catch (error) {
      // channels.fetch lève « Missing Access » si le bot ne voit pas le salon.
      this.logger.error("salon de chat inaccessible", {
        channelId: this.channelId,
        error,
      });
    }
  }
}
