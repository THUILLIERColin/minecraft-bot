import { Client, GatewayIntentBits } from "discord.js";

/**
 * Crée un client Discord et résout quand il est prêt. GuildMessages et
 * MessageContent sont nécessaires au relais de chat (ChatBridge) ; ce dernier
 * est un intent privilégié à activer dans le Discord Developer Portal, sinon
 * la connexion échoue.
 */
export async function createDiscordClient(token: string): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  await new Promise<void>((resolve, reject) => {
    client.once("clientReady", () => resolve());
    client.once("error", reject);
    client.login(token).catch(reject);
  });

  return client;
}
