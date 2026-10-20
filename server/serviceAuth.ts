import { createHash } from 'node:crypto';
import { buildAuthorization } from '@retroachievements/api';
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
} from 'psn-api';

/*
  Credenciais de serviço
  ──────────────────────
  O Zenkuri consulta apenas dados públicos dos perfis, no modelo PSNProfiles:
  o servidor mantém UMA credencial por plataforma (.env) e os usuários
  informam somente identificadores públicos (SteamID, online ID, username).
  Nenhuma credencial de usuário é armazenada.
*/

export function steamServiceKey(): string {
  const key = String(process.env.ZENKURI_STEAM_API_KEY ?? '').trim();
  if (!key) throw new Error('ZENKURI_STEAM_API_KEY não configurada no servidor.');
  return key;
}

export function raServiceAuth() {
  const username = String(process.env.ZENKURI_RA_USERNAME ?? '').trim();
  const webApiKey = String(process.env.ZENKURI_RA_API_KEY ?? '').trim();
  if (!username || !webApiKey) throw new Error('ZENKURI_RA_USERNAME / ZENKURI_RA_API_KEY não configuradas no servidor.');
  return buildAuthorization({ username, webApiKey });
}

interface PsnTokenState {
  npssoHash?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
}

// Tokens derivados do NPSSO vivem apenas na memória do processo. Reiniciar o
// servidor limpa o cache; nenhum segredo da conta de serviço vai para o SQLite.
let psnTokenState: PsnTokenState = {};
let psnAuthInFlight: Promise<{ accessToken: string }> | null = null;

/**
 * Autenticação PSN da conta de serviço. Os tokens trocados a partir do NPSSO
 * ficam somente em memória, amarrados ao hash do NPSSO. Trocar o NPSSO no
 * .env e reiniciar o servidor invalida o cache automaticamente.
 */
export async function psnServiceAuth(): Promise<{ accessToken: string }> {
  const npsso = String(process.env.ZENKURI_PSN_NPSSO ?? '').trim();
  if (!npsso) throw new Error('ZENKURI_PSN_NPSSO não configurado no servidor.');

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
        // Um refresh pode ser revogado antes do prazo. Refazemos a troca pelo
        // NPSSO configurado sem persistir o token que falhou.
        psnTokenState = {};
      }
    }

    let tokens;
    try {
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      tokens = await exchangeAccessCodeForAuthTokens(accessCode);
    } catch {
      throw new Error('A credencial de serviço da PSN expirou. Atualize ZENKURI_PSN_NPSSO no .env e reinicie o servidor.');
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
