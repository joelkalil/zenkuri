import { steamServiceKey } from './serviceAuth';

const STORE_BROWSE_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';
export const STEAM_META_BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 20_000;

export interface SteamStoreMeta {
  appid: string;
  developers: string[];
  publishers: string[];
  franchises: string[];
  /** null when Steam returned the item successfully. */
  error: string | null;
}

interface StoreItemName {
  name?: string;
}

interface StoreItem {
  appid?: number;
  success?: number;
  basic_info?: {
    developers?: StoreItemName[];
    publishers?: StoreItemName[];
    franchises?: StoreItemName[];
  };
}

function names(list: StoreItemName[] | undefined): string[] {
  return (list ?? [])
    .map((entry) => entry.name?.trim() ?? '')
    .filter((name) => name !== '');
}

/** Converts `response.store_items[]` into rows; items with success != 1 become empty + error. */
export function parseSteamStoreItems(body: unknown): SteamStoreMeta[] {
  const items = (body as { response?: { store_items?: StoreItem[] } } | null)?.response?.store_items ?? [];
  const parsed: SteamStoreMeta[] = [];
  for (const item of items) {
    if (item.appid === undefined) continue;
    const appid = String(item.appid);
    if (item.success !== 1) {
      parsed.push({ appid, developers: [], publishers: [], franchises: [], error: `Steam store item unavailable (success=${item.success ?? 'missing'})` });
      continue;
    }
    parsed.push({
      appid,
      developers: names(item.basic_info?.developers),
      publishers: names(item.basic_info?.publishers),
      franchises: names(item.basic_info?.franchises),
      error: null,
    });
  }
  return parsed;
}

/**
 * Fetches dev/pub/franchises for up to 50 appids in one call. Throws on a
 * network/HTTP failure (transient: the caller stores nothing); appids missing
 * from the response are left out.
 */
export async function fetchSteamStoreMeta(appids: string[]): Promise<SteamStoreMeta[]> {
  if (appids.length === 0) return [];
  if (appids.length > STEAM_META_BATCH_SIZE) throw new Error(`At most ${STEAM_META_BATCH_SIZE} appids per request.`);
  const input = {
    ids: appids.map((appid) => ({ appid: Number(appid) })),
    context: { language: 'english', country_code: 'US' },
    data_request: { include_basic_info: true },
  };
  const url = new URL(STORE_BROWSE_URL);
  url.searchParams.set('key', steamServiceKey());
  url.searchParams.set('input_json', JSON.stringify(input));
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Steam store API error ${res.status}`);
  return parseSteamStoreItems(await res.json());
}
