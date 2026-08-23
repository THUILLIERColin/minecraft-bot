import { type Client } from "discord.js";
import type { Logger } from "../logger.js";

export class PlayerFeed {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly logger: Logger,
  ) {}

  async announceJoin(name: string): Promise<void> {
    await this.send(`:green_circle: **[${this.timestamp()}] [LOG] ${name}** joined the server`);
  }

  async announceLeave(name: string): Promise<void> {
    await this.send(`:red_circle: **[${this.timestamp()}] [LOG] ${name}** left the server`);
  }

  private timestamp(): string {
    const now = new Date();
    const pad = (value: number): string => value.toString().padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
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
