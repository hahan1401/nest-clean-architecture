/**
 * Google speaks two error dialects: OAuth returns `{ error, error_description }`
 * while the Gmail API returns `{ error: { code, message, status } }`.
 * Both are flattened to one line so logs stay readable and never carry credentials.
 */
export function describeGoogleError(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;

  if (data && typeof data === 'object') {
    const { error: inner, error_description: description } = data as {
      error?: unknown;
      error_description?: unknown;
    };

    if (inner && typeof inner === 'object') {
      const { status, message } = inner as { status?: unknown; message?: unknown };

      if (status || message) {
        return [status, message].filter(Boolean).join(': ');
      }
    }

    if (typeof inner === 'string' || description) {
      return [inner, description].filter(Boolean).join(': ');
    }

    return JSON.stringify(data);
  }

  return error instanceof Error ? error.message : String(error);
}
