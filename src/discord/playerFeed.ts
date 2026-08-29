import type { Client } from "discord.js";
import type { Logger } from "../logger/logger.js";

export class PlayerFeed {
  constructor(
    private readonly client: Client,
    private readonly channelId: string,
    private readonly logger: Logger,
  ) {}

  async announceJoin(name: string): Promise<void> {
    await this.send(
      `:green_circle: **[${this.timestamp()}] [LOG] ${name}** joined the server`,
    );
  }

  async announceLeave(name: string): Promise<void> {
    await this.send(
      `:red_circle: **[${this.timestamp()}] [LOG] ${name}** left the server`,
    );
  }

  private timestamp(): string {
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
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
