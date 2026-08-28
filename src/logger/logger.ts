export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

function emit(level: LogLevel, message: string, context?: unknown): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${level.toUpperCase()} ${message}`;
  const stream = level === "error" ? console.error : console.log;
  if (context === undefined) {
    stream(line);
  } else {
    stream(line, context);
  }
}

export const logger: Logger = {
  info: (message, context) => emit("info", message, context),
  warn: (message, context) => emit("warn", message, context),
  error: (message, context) => emit("error", message, context),
};
