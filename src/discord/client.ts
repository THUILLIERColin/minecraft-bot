import { Client, GatewayIntentBits } from "discord.js";

/**
 * Crée un client Discord et résout une fois qu'il est prêt. Les intents sont
 * réduits au strict nécessaire : on ne lit aucun message, on agit uniquement
 * sur des salons et catégories dont on connaît l'ID.
 */
export async function createDiscordClient(token: string): Promise<Client> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise<void>((resolve, reject) => {
    client.once("clientReady", () => resolve());
    client.once("error", reject);
    void client.login(token).catch(reject);
  });

  return client;
}
