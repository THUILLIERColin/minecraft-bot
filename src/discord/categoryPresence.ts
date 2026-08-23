import { ChannelType, type Client } from "discord.js";
import type { Logger } from "../logger.js";

const ONLINE_NAME = "🟢 MINECRAFT · available";
const OFFLINE_NAME = "🔴 MINECRAFT · unavailable";

export class CategoryPresence {
  constructor(
    private readonly client: Client,
    private readonly categoryId: string,
    private readonly logger: Logger,
  ) {}

  async setOnline(): Promise<void> {
    await this.rename(ONLINE_NAME);
  }

  async setOffline(): Promise<void> {
    await this.rename(OFFLINE_NAME);
  }

  private async rename(name: string): Promise<void> {
    const channel = await this.client.channels.fetch(this.categoryId);

    if (channel?.type !== ChannelType.GuildCategory) {
      this.logger.error("category id ne pointe pas vers une catégorie", {
        categoryId: this.categoryId,
      });
      return;
    }

    if (channel.name === name) return;

    await channel.setName(name);
    this.logger.info("catégorie renommée", { name });
  }
}
