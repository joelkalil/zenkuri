import { createHash } from 'node:crypto';
import { buildAuthorization } from '@retroachievements/api';
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
} from 'psn-api';
import { envString } from './env';
import { ApiError } from './errors';

/*
  Service credentials
  ───────────────────
  Zenkuri only reads public profile data, PSNProfiles-style: the server keeps
  ONE credential per platform (.env) and users only provide public identifiers
  (SteamID, online ID, username). No user credential is ever stored.
*/

export function steamServiceKey(): string {
  const key = envString('ZENKURI_STEAM_API_KEY', '');
  if (!key) throw new ApiError('sync.steam_service_not_configured', 503);
  return key;
}

export function raServiceAuth() {
  const username = envString('ZENKURI_RA_USERNAME', '');
  const webApiKey = envString('ZENKURI_RA_API_KEY', '');
  if (!username || !webApiKey) throw new ApiError('sync.ra_service_not_configured', 503);
  return buildAuthorization({ username, webApiKey });
}

interface PsnTokenState {
  npssoHash?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
}

// Tokens derived from the NPSSO live only in process memory. Restarting the
// server clears the cache; no service-account secret is written to SQLite.
let psnTokenState: PsnTokenState = {};
let psnAuthInFlight: Promise<{ accessToken: string }> | null = null;

/**
 * PSN authentication for the service account. Tokens exchanged from the NPSSO
 * stay in memory only, tied to the NPSSO hash. Changing the NPSSO in .env and
 * restarting the server invalidates the cache automatically.
 */
export async function psnServiceAuth(): Promise<{ accessToken: string }> {
  const npsso = envString('ZENKURI_PSN_NPSSO', '');
  if (!npsso) throw new ApiError('sync.psn_service_not_configured', 503);

  const npssoHash = createHash('sha256').update(npsso).digest('hex');
  const now = Date.now();

  if (psnTokenState.npssoHash === npssoHash) {
    if (psnTokenState.accessToken && psnTokenState.expiresAt && psnTokenState.expiresAt - 60_000 > now) {
      return { accessToken: psnTokenState.accessToken };
    }
  }

  if (psnAuthInFlight) return psnAuthInFlight;

  psnAuthInFlight = (async () => {
    if (
      psnTokenState.npssoHash === npssoHash
      && psnTokenState.refreshToken
      && (!psnTokenState.refreshExpiresAt || psnTokenState.refreshExpiresAt > Date.now())
    ) {
      try {
        const tokens = await exchangeRefreshTokenForAuthTokens(psnTokenState.refreshToken);
        const refreshedAt = Date.now();
        psnTokenState = {
          npssoHash,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: refreshedAt + tokens.expiresIn * 1000,
          refreshExpiresAt: refreshedAt + tokens.refreshTokenExpiresIn * 1000,
        };
        return { accessToken: tokens.accessToken };
      } catch {
        // A refresh token can be revoked early. Redo the exchange from the
        // configured NPSSO without persisting the token that failed.
        psnTokenState = {};
      }
    }

    let tokens;
    try {
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      tokens = await exchangeAccessCodeForAuthTokens(accessCode);
    } catch {
      throw new ApiError('sync.psn_credential_expired', 503);
    }
    const exchangedAt = Date.now();
    psnTokenState = {
      npssoHash,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: exchangedAt + tokens.expiresIn * 1000,
      refreshExpiresAt: exchangedAt + tokens.refreshTokenExpiresIn * 1000,
    };
    return { accessToken: tokens.accessToken };
  })();

  try {
    return await psnAuthInFlight;
  } finally {
    psnAuthInFlight = null;
  }
}
