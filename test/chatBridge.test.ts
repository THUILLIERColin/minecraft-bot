import { describe, it, expect } from "vitest";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import {
  buildTellrawCommand,
  missingChatPermissions,
  tellrawFailure,
} from "../src/discord/chatBridge.js";

interface TellrawComponent {
  text: string;
  color?: string;
  bold?: boolean;
}

function parsePayload(command: string): TellrawComponent[] {
  return JSON.parse(command.replace("tellraw @a ", "")) as TellrawComponent[];
}

describe("buildTellrawCommand", () => {
  it("construit une commande tellraw avec le pseudo et le message", () => {
    const command = buildTellrawCommand("Alice", "salut !");
    expect(command).toBe(
      'tellraw @a [{"text":"[Discord] ","color":"aqua"},{"text":"Alice: ","bold":true},{"text":"salut !"}]',
    );
  });

  it("retourne null pour un message vide", () => {
    expect(buildTellrawCommand("Alice", "")).toBeNull();
    expect(buildTellrawCommand("Alice", "   ")).toBeNull();
  });

  it("échappe les guillemets et backslashes sans casser le JSON", () => {
    const command = buildTellrawCommand("Alice", 'il a dit "salut" \\o/');
    expect(command).not.toBeNull();
    expect(() => parsePayload(command!)).not.toThrow();
  });

  it("aplatit les espaces multiples et les retours à la ligne", () => {
    const command = buildTellrawCommand("Alice", "ligne1\n\nligne2   fin");
    const payload = parsePayload(command!);
    expect(payload[2].text).toBe("ligne1 ligne2 fin");
  });

  it("tronque les messages trop longs", () => {
    const long = "a".repeat(300);
    const command = buildTellrawCommand("Alice", long);
    const payload = parsePayload(command!);
    expect(payload[2].text.length).toBe(201);
    expect(payload[2].text.endsWith("…")).toBe(true);
  });
});

describe("tellrawFailure", () => {
  it("considère une réponse vide comme un succès", () => {
    expect(tellrawFailure("")).toBeNull();
    expect(tellrawFailure("  \n")).toBeNull();
  });

  it("remonte la réponse du serveur quand elle n'est pas vide", () => {
    expect(tellrawFailure("No player was found\n")).toBe("No player was found");
    expect(
      tellrawFailure("Unknown or incomplete command, see below for error"),
    ).toBe("Unknown or incomplete command, see below for error");
  });
});

describe("missingChatPermissions", () => {
  it("ne signale rien quand le bot peut voir le salon et y écrire", () => {
    const permissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]);
    expect(missingChatPermissions(permissions)).toEqual([]);
  });

  it("liste les permissions manquantes", () => {
    const permissions = new PermissionsBitField([
      PermissionFlagsBits.SendMessages,
    ]);
    expect(missingChatPermissions(permissions)).toEqual(["Voir le salon"]);
  });

  it("considère un administrateur comme ayant toutes les permissions", () => {
    const permissions = new PermissionsBitField([
      PermissionFlagsBits.Administrator,
    ]);
    expect(missingChatPermissions(permissions)).toEqual([]);
  });
});
