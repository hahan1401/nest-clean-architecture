import { Params } from 'nestjs-pino';

type PinoHttpRequest = {
  url?: string;
  method?: string;
  query?: unknown;
  body?: unknown;
  requestId?: string;
};

const isPrettyLoggingEnabled = process.env.NODE_ENV !== 'production';

/**
 * Paths whose last segment is a bearer credential rather than an identifier.
 * `redact.paths` cannot help here: it matches object properties, not a substring
 * of a URL, so the token has to be masked while the URL is still being built.
 */
const CREDENTIAL_PATH_PREFIXES = ['/bookings/cancel/'];

const maskCredentialSegments = (url: string): string => {
  const prefix = CREDENTIAL_PATH_PREFIXES.find((candidate) => url.startsWith(candidate));
  return prefix ? `${prefix}[REDACTED]` : url;
};

export function createPinoHttpConfig(serviceName: string): Params['pinoHttp'] {
  return {
    customProps: (req: PinoHttpRequest) => ({
      body: req.body,
      requestId: req.requestId,
    }),
    autoLogging: false,
    serializers: {
      req: (req: PinoHttpRequest) => {
        const path = req.url?.split('?')[0];
        return {
          url: path === undefined ? undefined : maskCredentialSegments(path),
          method: req.method,
          requestId: req.requestId,
          query: req.query,
          body: req.body,
        };
      },
      res: () => undefined,
    },
    redact: {
      paths: [
        'req.body.password',
        'body.password',
        'req.headers.authorization',
        'vnp_HashSecret',
        '*.vnp_HashSecret',
      ],
      censor: '[REDACTED]',
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
