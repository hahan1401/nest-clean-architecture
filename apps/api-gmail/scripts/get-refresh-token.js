#!/usr/bin/env node
/**
 * One-off helper that walks the Google OAuth consent flow and prints the refresh
 * token api-gmail needs. Run it once per sending mailbox:
 *
 *   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node apps/api-gmail/scripts/get-refresh-token.js
 *
 * It listens on a loopback port, so the OAuth client must be of type "Desktop app"
 * (Google allows any 127.0.0.1 port for those without pre-registering a redirect URI).
 *
 * If the callback never lands - the usual case is WSL2, where the browser runs on
 * Windows and cannot always reach a server inside the VM - paste the redirect URL
 * from the browser's address bar into this terminal instead. Both paths are live at
 * the same time; whichever arrives first completes the flow.
 */
const { createHash, randomBytes } = require('node:crypto');
const { createServer } = require('node:http');
const { createInterface } = require('node:readline');

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = process.env.GMAIL_TOKEN_ENDPOINT || 'https://oauth2.googleapis.com/token';
const PORT = Number(process.env.OAUTH_CALLBACK_PORT || 53682);

// Google demands a loopback literal in redirect_uri, but we bind wider than that on
// purpose: WSL2 forwards Windows' localhost to the VM's eth0 address, so a server
// bound only to 127.0.0.1 inside WSL is unreachable from a Windows browser.
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const BIND_HOST = process.env.OAUTH_BIND_HOST || '0.0.0.0';

const clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();

if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET before running this script.');
  process.exit(1);
}

const base64url = (buffer) => buffer.toString('base64url');
const verifier = base64url(randomBytes(32));
const challenge = base64url(createHash('sha256').update(verifier).digest());
const state = base64url(randomBytes(16));

const authUrl = `${AUTH_ENDPOINT}?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  // Both are required: offline asks for a refresh token, consent forces Google to
  // re-issue one even if this account already granted the scope.
  access_type: 'offline',
  prompt: 'consent',
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state,
})}`;

async function exchange(code) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${body.error || response.status}: ${body.error_description || ''}`);
  }

  return body;
}

/** The browser callback and a pasted URL race each other; only the first one counts. */
let settled = false;

function quit(code) {
  server.close(() => process.exit(code));
  // The readline handle would keep the loop alive after the server closes.
  reader.close();
}

/** Exchanges the code and prints the result. `respond` reports back to the browser, if any. */
function complete(code, respond) {
  if (settled) {
    return;
  }

  settled = true;

  exchange(code)
    .then((token) => {
      respond('Done. You can close this tab and go back to the terminal.', 200);

      if (!token.refresh_token) {
        console.error(
          '\nGoogle did not return a refresh_token. This happens when the account has an\n' +
            'existing grant; revoke it at https://myaccount.google.com/permissions and retry.',
        );
        quit(1);
        return;
      }

      console.log('\nAdd this to apps/api-gmail/.env.local:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${token.refresh_token}\n`);
      console.log(`Scope granted: ${token.scope}`);
      quit(0);
    })
    .catch((error) => {
      respond('Token exchange failed. Check the terminal.', 500);
      console.error(`\nToken exchange failed - ${error.message}`);
      quit(1);
    });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, REDIRECT_URI);

  const finish = (message, code) => {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
  };

  if (url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }

  if (url.searchParams.get('error')) {
    finish('Consent was denied. Check the terminal.', 400);
    console.error(`\nGoogle returned an error: ${url.searchParams.get('error')}`);
    quit(1);
    return;
  }

  if (url.searchParams.get('state') !== state) {
    finish('State mismatch, ignoring this callback.', 400);
    return;
  }

  const code = url.searchParams.get('code');

  if (!code) {
    finish('No authorization code in the callback.', 400);
    return;
  }

  complete(code, finish);
});

/** Accepts a full redirect URL, a bare query string, or just the code itself. */
function extractCode(input) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const query = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : trimmed;
  const params = new URLSearchParams(query);
  const code = params.get('code');

  if (code) {
    if (params.get('state') && params.get('state') !== state) {
      console.error('That URL is from a different run of this script - ignoring it.');
      return null;
    }

    return code;
  }

  // A bare code pasted straight out of the address bar is still percent-encoded.
  return trimmed.includes('%') ? decodeURIComponent(trimmed) : trimmed;
}

const reader = createInterface({ input: process.stdin });

reader.on('line', (line) => {
  const code = extractCode(line);

  if (code) {
    complete(code, () => {});
  }
});

server.listen(PORT, BIND_HOST, () => {
  console.log('Open this URL, sign in as the sending mailbox, and approve:\n');
  console.log(`${authUrl}\n`);
  console.log(`Waiting for the callback on ${REDIRECT_URI} ...`);
  console.log(
    '\nIf the browser lands on a "site cannot be reached" page (common on WSL2),\n' +
      'copy the full URL out of the address bar and paste it here, then press Enter.',
  );
  console.log(
    `\nIf Google says redirect_uri_mismatch, the OAuth client is a "Web application".\n` +
      `Either create a "Desktop app" client instead, or register this exact URI on the\n` +
      `existing one (Credentials > your client > Authorized redirect URIs):\n\n` +
      `  ${REDIRECT_URI}\n\n` +
      `It must match character for character - "localhost" is not the same as "127.0.0.1".\n` +
      `Set OAUTH_CALLBACK_PORT to reuse a port you have already registered.`,
  );
});
