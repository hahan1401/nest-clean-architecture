import { DependencyError } from '@app/common';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { GmailTokenPort } from '../../domain/ports/gmail-token.port';
import { describeGoogleError } from '../http/describe-google-error';

const DEFAULT_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** Refresh a little early so a token never expires mid-flight. */
const EXPIRY_SKEW_MS = 60_000;

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

/**
 * Exchanges a long-lived OAuth2 refresh token for short-lived access tokens
 * and caches them until they are about to expire.
 */
@Injectable()
export class GmailOauthTokenService implements GmailTokenPort {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly tokenEndpoint: string;

  private cached: { token: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GmailOauthTokenService.name);

    this.clientId = this.configService.get<string>('GMAIL_CLIENT_ID')?.trim() ?? '';
    this.clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET')?.trim() ?? '';
    this.refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN')?.trim() ?? '';
    this.tokenEndpoint =
      this.configService.get<string>('GMAIL_TOKEN_ENDPOINT')?.trim() || DEFAULT_TOKEN_ENDPOINT;

    // Fail at boot rather than on the first booking confirmation email.
    const missing = [
      ['GMAIL_CLIENT_ID', this.clientId],
      ['GMAIL_CLIENT_SECRET', this.clientSecret],
      ['GMAIL_REFRESH_TOKEN', this.refreshToken],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length) {
      throw new Error(`Gmail OAuth is not configured, missing: ${missing.join(', ')}`);
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.token;
    }

    // Collapse concurrent misses onto a single refresh call.
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async refresh(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const response = await this.httpService.axiosRef.post<GoogleTokenResponse>(
        this.tokenEndpoint,
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const { access_token: accessToken, expires_in: expiresIn } = response.data;

      if (!accessToken) {
        throw new Error('Google token endpoint returned no access_token');
      }

      this.cached = {
        token: accessToken,
        expiresAt: Date.now() + Math.max(expiresIn * 1000 - EXPIRY_SKEW_MS, 0),
      };

      return accessToken;
    } catch (error) {
      this.cached = null;
      this.logger.error(
        { err: describeGoogleError(error) },
        'Failed to refresh the Gmail access token',
      );
      throw new DependencyError('Unable to obtain a Gmail access token', error);
    }
  }
}
