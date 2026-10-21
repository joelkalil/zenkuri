import { getUserPlayedGames, getUserTrophiesForSpecificTitle } from 'psn-api';
import { ASSET_ORIGIN, updateCatalogGame, type CatalogAsset } from '../mediaCatalog';
import { psnServiceAuth } from '../serviceAuth';
import { psnAccountId } from './psnAccount';

/*
  PSN concept art
  ───────────────
  Trophy titles only carry a square trophy icon. The "played games" list exposes
  each game's concept media (box art, backgrounds, banners). We map those
  concepts back to trophy sets (npCommunicationId) and store the best images in
  the media catalog. The preference lists below are tunable: the distinct image
  types seen are logged after every refresh.
*/

/** Square-ish box art, best first. */
export const PSN_PORTRAIT_TYPES = ['GAMEHUB_COVER_ART', 'MASTER', 'PORTRAIT_BANNER'] as const;
/** Wide art, best first. */
export const PSN_HERO_TYPES = [
  'BACKGROUND',
  'FOUR_BY_THREE_BANNER',
  'LANDSCAPE_BANNER',
  'SCREENSHOT',
  'GAMEHUB_COVER_ART',
] as const;

const PAGE_SIZE = 200;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

export interface PsnTrophyTitleRef {
  npCommunicationId: string;
  name: string;
}

interface ConceptImage { url: string; type: string }

function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\b(trophies|trophy set|trophy|ps4|ps5|edition|remastered)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function pickImage(images: ConceptImage[], preference: readonly string[]): ConceptImage | undefined {
  for (const type of preference) {
    const hit = images.find((image) => image.type === type && image.url);
    if (hit) return hit;
  }
  return undefined;
}

function toAsset(image: ConceptImage | undefined): CatalogAsset | undefined {
  return image ? { url: image.url, origin: ASSET_ORIGIN.PSN_CONCEPT, imageType: image.type } : undefined;
}

const PSN_CALL_TIMEOUT_MS = 20_000;

async function withTimeout<T>(call: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), PSN_CALL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Authorization = Awaited<ReturnType<typeof psnServiceAuth>>;

/** npTitleId → npCommunicationIds, resolved in sequential batches of 5. */
async function mapTitleIds(
  authorization: Authorization,
  accountId: string,
  titleIds: string[],
): Promise<Map<string, string[]>> {
  const mapping = new Map<string, string[]>();
  const record = (response: Awaited<ReturnType<typeof getUserTrophiesForSpecificTitle>>) => {
    for (const entry of response.titles ?? []) {
      const ids = (entry.trophyTitles ?? []).map((t) => t.npCommunicationId);
      if (ids.length > 0) mapping.set(entry.npTitleId, ids);
    }
  };
  for (let i = 0; i < titleIds.length; i += BATCH_SIZE) {
    const batch = titleIds.slice(i, i + BATCH_SIZE);
    try {
      record(await withTimeout(getUserTrophiesForSpecificTitle(authorization, accountId, { npTitleIds: batch.join(',') }), 'PSN title lookup'));
    } catch {
      // One unknown id fails the whole batch: retry singly.
      for (const id of batch) {
        try {
          await sleep(BATCH_DELAY_MS);
          record(await withTimeout(getUserTrophiesForSpecificTitle(authorization, accountId, { npTitleIds: id }), 'PSN title lookup'));
        } catch { /* title has no trophy set for this account */ }
      }
    }
    await sleep(BATCH_DELAY_MS);
  }
  return mapping;
}

/**
 * Refresh concept art for the user's PSN library into the media catalog.
 * Never throws: failures are logged and the sync carries on.
 */
export async function refreshPsnConceptArt(userId: number, trophyTitles: PsnTrophyTitleRef[] = []): Promise<void> {
  try {
    const accountId = psnAccountId(userId);
    const authorization = await withTimeout(psnServiceAuth(), 'PSN auth');
    const known = new Map(trophyTitles.map((t) => [t.npCommunicationId, t.name]));
    const byName = new Map(trophyTitles.map((t) => [normalizeName(t.name), t.npCommunicationId]));

    const played: Awaited<ReturnType<typeof getUserPlayedGames>>['titles'] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await withTimeout(getUserPlayedGames(authorization, accountId, { limit: PAGE_SIZE, offset }), 'PSN played games');
      const titles = page.titles ?? [];
      played.push(...titles);
      if (titles.length < PAGE_SIZE) break;
      await sleep(BATCH_DELAY_MS);
    }

    const titleIdMap = await mapTitleIds(authorization, accountId, [...new Set(played.map((t) => t.titleId))]);

    const typeCounts = new Map<string, number>();
    let mapped = 0;
    const seenSets = new Set<string>();
    for (const title of played) {
      const images = title.concept?.media?.images ?? [];
      for (const image of images) typeCounts.set(image.type, (typeCounts.get(image.type) ?? 0) + 1);

      const ids = new Set(titleIdMap.get(title.titleId) ?? []);
      if (ids.size === 0) {
        const byConceptName = byName.get(normalizeName(title.concept?.name ?? title.name));
        if (byConceptName) ids.add(byConceptName);
      }
      const portrait = toAsset(pickImage(images, PSN_PORTRAIT_TYPES));
      const hero = toAsset(pickImage(images, PSN_HERO_TYPES));
      if (!portrait && !hero) continue;

      for (const npCommunicationId of ids) {
        if (known.size > 0 && !known.has(npCommunicationId)) continue;
        if (seenSets.has(npCommunicationId)) continue;
        seenSets.add(npCommunicationId);
        updateCatalogGame('psn', npCommunicationId, known.get(npCommunicationId) ?? title.name, {
          assets: { ...(portrait ? { portrait, cover: portrait } : {}), ...(hero ? { hero } : {}) },
          psn: {
            titleIds: [...new Set([title.titleId, ...(title.concept?.titleIds ?? [])])],
            conceptId: title.concept?.id,
          },
        });
        mapped += 1;
      }
    }

    const types = [...typeCounts].map(([type, n]) => `${type}(${n})`).join(', ') || 'none';
    console.log(`[psn-art] concept art for ${mapped}/${known.size || played.length} trophy sets from ${played.length} played titles; image types seen: ${types}`);
  } catch (error) {
    console.warn(`[psn-art] concept art refresh failed: ${(error as Error).message}`);
  }
}
