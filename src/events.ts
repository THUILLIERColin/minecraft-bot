export type MonitorEvent =
  | { type: "serverWentOnline"; playerCount: number; maxPlayers: number }
  | { type: "serverWentOffline" }
  | { type: "playerJoined"; name: string }
  | { type: "playerLeft"; name: string };

export type MonitorEventHandler = (event: MonitorEvent) => void | Promise<void>;
