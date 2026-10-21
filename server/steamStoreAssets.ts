import {
  ASSET_ORIGIN,
  getCatalogGame,
  updateCatalogGame,
  type AssetKind,
  type CatalogAsset,
} from './mediaCatalog';

const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRANSIENT_FAILURE_TTL_MS = 60 * 60 * 1000;
const STORE_ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/';

/** Store asset keys per kind, best first. */
const STORE_FILES = {
  portrait: ['library_capsule_2x', 'library_capsule'],
  cover: ['header_2x', 'header', 'main_capsule_2x', 'main_capsule'],
  hero: ['library_hero_2x', 'library_hero'],
} as const;

interface StoreItemAssets {
  asset_url_format?: string;
  community_icon?: string;
  [file: string]: string | undefined;
}

type StoreAssets = Partial<Record<AssetKind, CatalogAsset>>;

const inflight = new Map<string, Promise<StoreAssets>>();
/** appid → epoch ms of the last transient (network/HTTP) failure; in memory only. */
const transientFailures = new Map<string, number>();

async function fetchStoreAssets(appid: string): Promise<{ assets: StoreAssets; found: boolean } | null> {
  const input = {
    ids: [{ appid: Number(appid) }],
    context: { language: 'english', country_code: 'US' },
    data_request: { include_assets: true },
  };
  try {
    const res = await fetch(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null; // transient: do not negative-cache
    const body = await res.json() as { response?: { store_items?: { assets?: StoreItemAssets }[] } };
    const raw = body.response?.store_items?.[0]?.assets;
    const assets: StoreAssets = {};
    if (raw?.asset_url_format) {
      const format = raw.asset_url_format;
      for (const [kind, files] of Object.entries(STORE_FILES) as [keyof typeof STORE_FILES, readonly string[]][]) {
        const file = files.find((name) => typeof raw[name] === 'string' && raw[name] !== '');
        const value = file ? raw[file] : undefined;
        if (file && value) {
          assets[kind] = {
            url: `${STORE_ASSET_BASE}${format.replace('${FILENAME}', value)}`,
            origin: ASSET_ORIGIN.STEAM_STORE,
            imageType: file,
          };
        }
      }
    }
    if (raw?.community_icon) {
      assets.icon = {
        url: `${COMMUNITY_ICON_BASE}${appid}/${raw.community_icon}.jpg`,
        origin: ASSET_ORIGIN.STEAM_STORE,
        imageType: 'community_icon',
      };
    }
    return { assets, found: Object.keys(assets).length > 0 };
  } catch {
    return null;
  }
}

/**
 * Hashed-path art from Steam's store API (newer apps 404 on the legacy paths).
 * Results are cached in the catalog; misses are negative-cached for 7 days.
 */
/** Community (library) icons; the old cdn.cloudflare `steamcommunity/public/images` path now 404s. */
const COMMUNITY_ICON_BASE = 'https://shared.fastly.steamstatic.com/community_assets/images/apps/';

export function steamStoreAssets(appid: string, title: string): Promise<StoreAssets> {
  if (!/^\d+$/.test(appid)) return Promise.resolve({});
  const failedAt = transientFailures.get(appid);
  if (failedAt !== undefined && Date.now() - failedAt < TRANSIENT_FAILURE_TTL_MS) return Promise.resolve({});
  const cached = getCatalogGame('steam', appid);
  // Entries cached before the community-icon host fix point at a dead CDN path; refetch them.
  const staleIcon = cached?.assets?.icon?.url !== undefined && !cached.assets.icon.url.startsWith(COMMUNITY_ICON_BASE);
  const check = staleIcon ? undefined : cached?.storeCheck;
  if (check?.found) return Promise.resolve(cached?.assets ?? {});
  if (check && Date.now() - Date.parse(check.at) < MISS_TTL_MS) return Promise.resolve({});

  const pending = inflight.get(appid);
  if (pending) return pending;
  const task = (async () => {
    const result = await fetchStoreAssets(appid);
    if (!result) {
      transientFailures.set(appid, Date.now());
      return {};
    }
    transientFailures.delete(appid);
    // The fresh response is authoritative for the icon: replace (or drop) it so a stale URL can't persist.
    updateCatalogGame('steam', appid, title, {
      assets: result.assets,
      storeCheck: { at: new Date().toISOString(), found: result.found },
    }, ['icon']);
    return result.assets;
  })().finally(() => inflight.delete(appid));
  inflight.set(appid, task);
  return task;
}
