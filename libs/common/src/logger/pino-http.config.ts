type PinoHttpRequest = {
  url?: string;
  method?: string;
  query?: unknown;
  body?: unknown;
  requestId?: string;
};

const isPrettyLoggingEnabled = process.env.NODE_ENV !== 'production';

export function createPinoHttpConfig(serviceName: string) {
  return {
    customProps: (req: PinoHttpRequest) => ({
      body: req.body,
      requestId: req.requestId,
    }),
    autoLogging: false,
    serializers: {
      req: (req: PinoHttpRequest) => {
        return {
          url: req.url?.split('?')[0],
          method: req.method,
          requestId: req.requestId,
          query: req.query,
          body: req.body,
        };
      },
      res: () => undefined,
    },
    level: process.env.LOG_LEVEL ?? 'info',
    transport: isPrettyLoggingEnabled
      ? {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            translateTime: 'yyyy-mm-dd"T"HH:MM:ss.l"Z"',
            ignore: 'pid,hostname',
            messageFormat: `[${serviceName}] {msg}`,
          },
        }
      : undefined,
  };
}