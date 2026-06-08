export type LogMeta = Record<string, unknown>;

export type Logger = {
  error: (message: string, error?: unknown, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
};

type LogSink = Pick<Console, 'error' | 'info' | 'warn'>;

function serializeError(error: unknown): LogMeta {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  return ` ${JSON.stringify(meta)}`;
}

export function createLogger(scope: string, sink: LogSink = console): Logger {
  const prefix = `[${scope}]`;

  return {
    error(message, error, meta) {
      sink.error(
        `${prefix} ${message}${formatMeta({
          ...meta,
          error: error ? serializeError(error) : undefined,
        })}`,
      );
    },
    info(message, meta) {
      sink.info(`${prefix} ${message}${formatMeta(meta)}`);
    },
    warn(message, meta) {
      sink.warn(`${prefix} ${message}${formatMeta(meta)}`);
    },
  };
}
