import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  appendFileSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseChatLine, LogTailer } from "../src/minecraft/chatLog.js";
import type { Logger } from "../src/logger/logger.js";

const logger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("parseChatLine", () => {
  it("extrait le pseudo et le message d'une ligne de chat", () => {
    expect(
      parseChatLine("[13:45:22] [Server thread/INFO]: <Colin> salut !"),
    ).toEqual({ player: "Colin", message: "salut !" });
  });

  it("ignore une ligne de connexion", () => {
    expect(
      parseChatLine("[13:45:22] [Server thread/INFO]: Colin joined the game"),
    ).toBeNull();
  });

  it("ignore un message tellraw injecté (pas de <pseudo>)", () => {
    expect(
      parseChatLine(
        "[13:45:22] [Server thread/INFO]: [Discord] Colin: salut !",
      ),
    ).toBeNull();
  });

  it("ignore une ligne serveur sans rapport", () => {
    expect(
      parseChatLine(
        '[13:45:22] [Server thread/INFO]: Done (12.345s)! For help, type "help"',
      ),
    ).toBeNull();
  });

  it("extrait le pseudo et le message d'une ligne Forge/NeoForge (logger en 3e groupe)", () => {
    expect(
      parseChatLine(
        "[29Aug2026 12:52:52.626] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: <ColinSaN57> je suis un test",
      ),
    ).toEqual({ player: "ColinSaN57", message: "je suis un test" });
  });

  it("extrait le pseudo et le message malgré le préfixe [Not Secure]", () => {
    expect(
      parseChatLine(
        "[13:45:22] [Server thread/INFO]: [Not Secure] <Colin> salut !",
      ),
    ).toEqual({ player: "Colin", message: "salut !" });
  });

  it("gère [Not Secure] combiné au format Forge/NeoForge", () => {
    expect(
      parseChatLine(
        "[29Aug2026 12:52:52.626] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: [Not Secure] <ColinSaN57> je suis un test",
      ),
    ).toEqual({ player: "ColinSaN57", message: "je suis un test" });
  });
});

describe("LogTailer", () => {
  function tempFile(initialContent = ""): string {
    const dir = mkdtempSync(join(tmpdir(), "mc-monitor-test-"));
    const path = join(dir, "latest.log");
    writeFileSync(path, initialContent);
    return path;
  }

  it("ne relit pas l'historique existant au démarrage", async () => {
    const path = tempFile(
      "[13:45:22] [Server thread/INFO]: <Alice> ancien message\n",
    );
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));

    await tailer.start();
    tailer.stop();
    await tailer.check();

    expect(lines).toEqual([]);
  });

  it("détecte les nouvelles lignes ajoutées", async () => {
    const path = tempFile();
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));
    await tailer.start();
    tailer.stop();

    appendFileSync(
      path,
      "[13:45:22] [Server thread/INFO]: <Bob> premier message\n",
    );
    await tailer.check();

    expect(lines).toEqual([
      "[13:45:22] [Server thread/INFO]: <Bob> premier message",
    ]);
  });

  it("conserve une ligne incomplète jusqu'à son retour à la ligne", async () => {
    const path = tempFile();
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));
    await tailer.start();
    tailer.stop();

    appendFileSync(path, "[13:45:22] [Server thread/INFO]: <Bob> incompl");
    await tailer.check();
    expect(lines).toEqual([]);

    appendFileSync(path, "et\n");
    await tailer.check();
    expect(lines).toEqual(["[13:45:22] [Server thread/INFO]: <Bob> incomplet"]);
  });

  it("repart de zéro si le fichier a été tronqué (redémarrage serveur)", async () => {
    const path = tempFile(
      "[13:45:22] [Server thread/INFO]: <Alice> avant redémarrage\n",
    );
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));
    await tailer.start();
    tailer.stop();

    // La troncature et l'écriture suivante sont deux écritures distinctes en
    // production, déclenchant chacune leur propre événement fs.watch : on
    // appelle check() entre les deux pour rester fidèle à cette granularité.
    truncateSync(path, 0);
    await tailer.check();

    appendFileSync(
      path,
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage\n",
    );
    await tailer.check();

    expect(lines).toEqual([
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage",
    ]);
  });
});
