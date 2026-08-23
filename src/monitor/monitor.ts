import type { MonitorEventHandler } from "../events.js";
import type { StatusSource } from "../minecraft/statusSource.js";
import { OFFLINE_STATE, type ServerState } from "../minecraft/types.js";
import type { Logger } from "../logger.js";
import { diffStates } from "./diff.js";

export interface MonitorOptions {
  source: StatusSource;
  intervalMs: number;
  logger: Logger;
}

/**
 * Interroge périodiquement une StatusSource et notifie ses abonnés des
 * changements. Ne connaît ni le protocole Minecraft ni Discord.
 */
export class Monitor {
  private previous: ServerState = OFFLINE_STATE;
  private timer: NodeJS.Timeout | null = null;
  private readonly handlers: MonitorEventHandler[] = [];

  constructor(private readonly options: MonitorOptions) {}

  onEvent(handler: MonitorEventHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    if (this.timer !== null) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.intervalMs);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
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
          this.options.logger.error("handler failed", { event, error });
        }
      }
    }
  }
}
