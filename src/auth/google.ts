import { OAuth2Client } from "google-auth-library";
import { getConfig } from "@config";

let _oauth2Client: OAuth2Client | null = null;

export function getOAuth2Client(): OAuth2Client {
  if (!_oauth2Client) {
    const config = getConfig();
    _oauth2Client = new OAuth2Client(
      config.GOOGLE_OAUTH_CLIENT_ID,
      config.GOOGLE_OAUTH_CLIENT_SECRET,
      `${config.SERVER_URL}/oauth/callback`,
    );
  }
  return _oauth2Client;
}

export function getAuthUrl(state: string): string {
  const config = getConfig();
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
    hd: config.ALLOWED_DOMAIN,
    prompt: "consent",
  });
}

export interface GoogleUser {
  email: string;
  hd?: string;
  name?: string;
}

export async function exchangeCode(code: string): Promise<GoogleUser> {
  const config = getConfig();
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("No ID token received from Google");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_OAUTH_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Invalid ID token payload");
  }

  return {
    email: payload.email,
    hd: payload.hd,
    name: payload.name,
  };
}

/** Reset singleton for testing. */
export function _resetClient(): void {
  _oauth2Client = null;
}
