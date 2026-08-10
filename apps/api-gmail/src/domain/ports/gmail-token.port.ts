/** Outbound port supplying OAuth2 access tokens for the Gmail API. */
export abstract class GmailTokenPort {
  abstract getAccessToken(): Promise<string>;

  /** Drops the cached token so the next call re-authenticates (used after a 401). */
  abstract invalidate(): void;
}
