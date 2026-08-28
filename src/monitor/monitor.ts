import type { MonitorEventHandler } from "./events.js";
import type { StatusSource } from "../minecraft/statusSource.js";
import { OFFLINE_STATE, type ServerState } from "../minecraft/types.js";
import type { Logger } from "../logger/logger.js";
import { diffStates } from "./diff.js";

export interface MonitorOptions {
  source: StatusSource;
  intervalMs: number;
  logger: Logger;
}

/**
 * Interroge périodiquement une StatusSource et notifie ses abonnés des
 * changements. Ne connaît ni le protocole Minecraft ni Discord.
 *
 * Le polling est auto-réordonnancé (setTimeout en fin de cycle plutôt que
 * setInterval) : un cycle lent ne provoque jamais d'empilement d'appels.
 */
export class Monitor {
  private previous: ServerState = OFFLINE_STATE;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly handlers: MonitorEventHandler[] = [];

  constructor(private readonly options: MonitorOptions) {}

  onEvent(handler: MonitorEventHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async loop(): Promise<void> {
    if (!this.running) return;

    try {
      await this.poll();
    } catch (error) {
      this.options.logger.error("cycle de monitoring échoué", { error });
    } finally {
      if (this.running) {
        this.timer = setTimeout(
          () => void this.loop(),
          this.options.intervalMs,
        );
      }
    }
  }

  private async poll(): Promise<void> {
    const current = await this.options.source.fetch();
    const events = diffStates(this.previous, current);
    this.previous = current;

    for (const event of events) {
      for (const handler of this.handlers) {
        try {
          await handler(event);
        } catch (error) {
          this.options.logger.error("handler d'événement échoué", {
            event,
            error,
          });
        }
      }
    }
  }
}
