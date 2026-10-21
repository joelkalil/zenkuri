import { getProfileFromUserName } from 'psn-api';
import { getUserProfile } from '@retroachievements/api';
import type { Platform } from './types';
import { getCredential, setCredential } from './db';
import { ApiError } from './errors';
import { psnServiceAuth, raServiceAuth, steamServiceKey } from './serviceAuth';

/*
  Account linking by public profile
  ─────────────────────────────────
  The user only provides a public identifier. The profile's existence is
  checked against the platform API and the link is then enabled for syncing.
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
  if (!vanity) throw new ApiError('sync.steam_id_required', 400);
  const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/');
  url.searchParams.set('key', steamServiceKey());
  url.searchParams.set('vanityurl', vanity);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API error ${res.status}`);
  const json = await res.json() as { response?: { success?: number; steamid?: string } };
  if (json.response?.success !== 1 || !json.response.steamid) {
    throw new ApiError('sync.steam_profile_not_found', 400);
  }
  return json.response.steamid;
}

/**
 * Registers (or re-registers) the user's platform link from the public
 * identifier. Checking that the profile exists is enough to enable the link,
 * since only public data is synced.
 */
export async function linkPlatform(userId: number, platform: Platform, identifierInput: string): Promise<PlatformLinkData> {
  const input = String(identifierInput ?? '').trim();
  if (!input) throw new ApiError('sync.identifier_required', 400);
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
      throw new ApiError('sync.psn_profile_not_found', 400);
    }
    fields = { onlineId: profile.onlineId, accountId: String(profile.accountId) };
  } else {
    let profile;
    try {
      profile = await getUserProfile(raServiceAuth(), { username: input });
    } catch {
      throw new ApiError('sync.ra_user_not_found', 400);
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

/** Profile text where the user must paste the verification code. */
async function fetchProfileText(platform: Platform, data: PlatformLinkData): Promise<string> {
  if (platform === 'psn') {
    const auth = await psnServiceAuth();
    const profile = (await getProfileFromUserName(auth, String(data.onlineId))).profile;
    return profile.aboutMe ?? '';
  }
  if (platform === 'steam') {
    const res = await fetch(`https://steamcommunity.com/profiles/${data.steamid}/?xml=1`);
    if (!res.ok) throw new ApiError('sync.steam_profile_unreadable', 400);
    const xml = await res.text();
    return xml.match(/<summary>\s*<!\[CDATA\[([\s\S]*?)\]\]>/i)?.[1] ?? '';
  }
  const profile = await getUserProfile(raServiceAuth(), { username: String(data.username) });
  return profile.motto ?? '';
}

export async function verifyPlatformLink(userId: number, platform: Platform): Promise<PlatformLinkData> {
  const data = getCredential(userId, platform)?.data as PlatformLinkData | undefined;
  if (!data) throw new ApiError('sync.verification_not_linked', 400);
  if (data.verified) return data;
  if (!data.code) throw new ApiError('sync.verification_no_pending_code', 400);

  const text = await fetchProfileText(platform, data);
  if (!text.toUpperCase().includes(String(data.code).toUpperCase())) {
    throw new ApiError('sync.verification_code_not_found', 400);
  }

  const next: PlatformLinkData = { ...data, verified: true, verifiedAt: new Date().toISOString() };
  delete next.code;
  setCredential(userId, platform, next as Record<string, unknown>);
  return next;
}

/** Throws a typed error when the link does not exist or is not verified yet. */
export function requireVerifiedLink(userId: number, platform: Platform): PlatformLinkData {
  const data = getCredential(userId, platform)?.data as PlatformLinkData | undefined;
  if (!data) throw new ApiError('sync.not_configured', 400, { message: `${platform} is not linked to this account.` });
  if (!data.verified) throw new ApiError('sync.link_not_verified', 400, { message: `The ${platform} link has not been verified yet.` });
  return data;
}
