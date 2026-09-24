import { describe, it, expect, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  appendFileSync,
  renameSync,
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

    // La troncature et l'écriture suivante peuvent tomber dans deux cycles de
    // surveillance distincts : on appelle check() entre les deux pour rester
    // fidèle à cette granularité.
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

  // Minecraft ne tronque pas latest.log au redémarrage : il le renomme puis en
  // crée un neuf. Le nouveau peut dépasser la taille de l'ancien avant la
  // lecture suivante, d'où l'intérêt de détecter le changement d'inode.
  it("suit le nouveau fichier après rotation, même s'il est plus gros que l'ancien", async () => {
    const path = tempFile("[13:45:22] [Server thread/INFO]: <Alice> avant\n");
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));
    await tailer.start();
    tailer.stop();

    renameSync(path, `${path}.1`);
    writeFileSync(
      path,
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage, plus long que l'ancien fichier\n",
    );
    await tailer.check();

    expect(lines).toEqual([
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage, plus long que l'ancien fichier",
    ]);
  });

  it("reste silencieux pendant l'absence du fichier puis lit le nouveau", async () => {
    const path = tempFile("[13:45:22] [Server thread/INFO]: <Alice> avant\n");
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line));
    await tailer.start();
    tailer.stop();

    renameSync(path, `${path}.1`);
    await expect(tailer.check()).resolves.toBeUndefined();

    writeFileSync(
      path,
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage, plus long que l'ancien fichier\n",
    );
    await tailer.check();

    expect(lines).toEqual([
      "[13:46:00] [Server thread/INFO]: <Alice> après redémarrage, plus long que l'ancien fichier",
    ]);
  });

  it("continue de relayer après une rotation, via la surveillance réelle du fichier", async () => {
    const path = tempFile("[13:45:22] [Server thread/INFO]: <Alice> avant\n");
    const lines: string[] = [];
    const tailer = new LogTailer(path, logger, (line) => lines.push(line), {
      intervalMs: 10,
    });
    await tailer.start();

    try {
      appendFileSync(path, "[13:45:30] [Server thread/INFO]: <Alice> un\n");
      await vi.waitFor(() => expect(lines).toHaveLength(1));

      renameSync(path, `${path}.1`);
      writeFileSync(path, "[13:46:00] [Server thread/INFO]: <Alice> deux\n");
      await vi.waitFor(() => expect(lines).toHaveLength(2));
    } finally {
      tailer.stop();
    }

    expect(lines).toEqual([
      "[13:45:30] [Server thread/INFO]: <Alice> un",
      "[13:46:00] [Server thread/INFO]: <Alice> deux",
    ]);
  });
});
