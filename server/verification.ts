import { getProfileFromUserName } from 'psn-api';
import { getUserProfile } from '@retroachievements/api';
import type { Platform } from './types';
import { getCredential, setCredential } from './db';
import { psnServiceAuth, raServiceAuth, steamServiceKey } from './serviceAuth';

/*
  Vínculo de contas por perfil público
  ───────────────────────────────────────
  O usuário informa só um identificador público. A existência do perfil é
  conferida pela API da plataforma e o vínculo é liberado para sincronização.
*/

export interface PlatformLinkData {
  verified: boolean;
  code?: string;
  verifiedAt?: string;
  steamid?: string;
  onlineId?: string;
  accountId?: string;
  username?: string;
  [key: string]: unknown;
}

async function resolveSteamId(input: string): Promise<string> {
  const raw = input.trim();
  const profileMatch = raw.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];
  if (/^\d{17}$/.test(raw)) return raw;

  const vanity = raw.match(/steamcommunity\.com\/id\/([^/\s?]+)/i)?.[1] ?? raw;
  if (!vanity) throw new Error('Informe o SteamID64 ou a URL do seu perfil Steam.');
  const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/');
  url.searchParams.set('key', steamServiceKey());
  url.searchParams.set('vanityurl', vanity);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  const json = await res.json() as { response?: { success?: number; steamid?: string } };
  if (json.response?.success !== 1 || !json.response.steamid) {
    throw new Error('Perfil Steam não encontrado. Informe o SteamID64 ou a URL do perfil.');
  }
  return json.response.steamid;
}

/**
 * Registra (ou re-registra) o vínculo de plataforma do usuário a partir do
 * identificador público. Validar que o perfil existe é suficiente para
 * habilitar o vínculo, pois apenas dados públicos são sincronizados.
 */
export async function linkPlatform(userId: number, platform: Platform, identifierInput: string): Promise<PlatformLinkData> {
  const input = String(identifierInput ?? '').trim();
  if (!input) throw new Error('Informe o identificador do seu perfil.');
  const existing = (getCredential(userId, platform)?.data ?? {}) as PlatformLinkData;

  let fields: Record<string, string>;
  if (platform === 'steam') {
    fields = { steamid: await resolveSteamId(input) };
  } else if (platform === 'psn') {
    const auth = await psnServiceAuth();
    let profile;
    try {
      profile = (await getProfileFromUserName(auth, input)).profile;
    } catch {
      throw new Error('Perfil PSN não encontrado. Confira o online ID.');
    }
    fields = { onlineId: profile.onlineId, accountId: String(profile.accountId) };
  } else {
    let profile;
    try {
      profile = await getUserProfile(raServiceAuth(), { username: input });
    } catch {
      throw new Error('Usuário do RetroAchievements não encontrado.');
    }
    fields = { username: profile.user };
  }

  const data: PlatformLinkData = {
    ...fields,
    verified: true,
    verifiedAt: existing.verifiedAt ?? new Date().toISOString(),
  };
  setCredential(userId, platform, data as Record<string, unknown>);
  return data;
}

/** Texto do perfil onde o usuário deve colar o código de verificação. */
async function fetchProfileText(platform: Platform, data: PlatformLinkData): Promise<string> {
  if (platform === 'psn') {
    const auth = await psnServiceAuth();
    const profile = (await getProfileFromUserName(auth, String(data.onlineId))).profile;
    return profile.aboutMe ?? '';
  }
  if (platform === 'steam') {
    const res = await fetch(`https://steamcommunity.com/profiles/${data.steamid}/?xml=1`);
    if (!res.ok) throw new Error('Não foi possível ler o perfil Steam. Ele está público?');
    const xml = await res.text();
    return xml.match(/<summary>\s*<!\[CDATA\[([\s\S]*?)\]\]>/i)?.[1] ?? '';
  }
  const profile = await getUserProfile(raServiceAuth(), { username: String(data.username) });
  return profile.motto ?? '';
}

export async function verifyPlatformLink(userId: number, platform: Platform): Promise<PlatformLinkData> {
  const data = getCredential(userId, platform)?.data as PlatformLinkData | undefined;
  if (!data) throw new Error('Vincule a conta antes de verificar.');
  if (data.verified) return data;
  if (!data.code) throw new Error('Nenhum código de verificação pendente. Vincule a conta novamente.');

  const text = await fetchProfileText(platform, data);
  if (!text.toUpperCase().includes(String(data.code).toUpperCase())) {
    throw new Error('Código não encontrado no perfil. Confira se salvou a alteração e tente de novo em alguns instantes.');
  }

  const next: PlatformLinkData = { ...data, verified: true, verifiedAt: new Date().toISOString() };
  delete next.code;
  setCredential(userId, platform, next as Record<string, unknown>);
  return next;
}

/** Lança erro amigável quando o vínculo não existe ou ainda não foi verificado. */
export function requireVerifiedLink(userId: number, platform: Platform): PlatformLinkData {
  const data = getCredential(userId, platform)?.data as PlatformLinkData | undefined;
  if (!data) throw new Error(`${platform} não está vinculado a esta conta.`);
  if (!data.verified) throw new Error(`O vínculo com ${platform} ainda não foi verificado.`);
  return data;
}
