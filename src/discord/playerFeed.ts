import { type Client } from "discord.js";
import type { Logger } from "../logger.js";

export class PlayerFeed {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly logger: Logger,
  ) {}

  async announceJoin(name: string): Promise<void> {
    await this.send(`➡️ **${name}** s'est connecté`);
  }

  async announceLeave(name: string): Promise<void> {
    await this.send(`⬅️ **${name}** s'est déconnecté`);
  }

  private async send(content: string): Promise<void> {
    const channel = await this.client.channels.fetch(this.channelId);

    if (channel === null || !channel.isSendable()) {
      this.logger.error("salon de feed introuvable ou non textuel", {
        channelId: this.channelId,
      });
      return;
    }

    await channel.send(content);
  }
}
