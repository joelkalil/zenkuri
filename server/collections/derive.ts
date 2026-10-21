import {
  franchisesFromTitle,
  isExcludedTitle,
  indexSagaSeeds,
  resolveName,
  type CollectionKind,
  type SagaSeed,
} from './rules';

export const MIN_GROUPS_PER_COLLECTION = 2;

export interface CollectionGame {
  id: number;
  platform: string;
  /** games.external_id; for steam it is the appid. */
  externalId: string;
  title: string;
  groupId: number | null;
}

export interface CollectionMeta {
  gameId: number;
  developers: string[];
  publishers: string[];
  franchises: string[];
}

export type MemberRole = 'dev' | 'pub' | 'both';
export type MemberSource = 'store' | 'title';

export interface AutoCollectionMember {
  gameId: number;
  role?: MemberRole;
  source: MemberSource;
}

export interface AutoCollection {
  /** `franchise:<key>` | `company:<key>` */
  id: string;
  kind: CollectionKind;
  name: string;
  members: AutoCollectionMember[];
  groupCount: number;
}

interface Accumulator {
  kind: CollectionKind;
  override?: string;
  spellings: Map<string, number>;
  members: Map<number, AutoCollectionMember>;
  groups: Set<string>;
}

function groupKeyOf(game: CollectionGame): string {
  return game.groupId === null ? `game:${game.id}` : `group:${game.groupId}`;
}

function mergeRole(current: MemberRole | undefined, next: 'dev' | 'pub'): MemberRole {
  if (current === undefined || current === next) return next;
  return 'both';
}

function mostFrequentSpelling(spellings: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

export function deriveAutoCollections(
  games: readonly CollectionGame[],
  metaRows: readonly CollectionMeta[],
  /** sagas published in the community; they seed franchises where the store gave no key */
  sagas: readonly SagaSeed[] = [],
): { franchises: AutoCollection[]; companies: AutoCollection[] } {
  const metaByGame = new Map(metaRows.map((row) => [row.gameId, row]));
  const sagaByAppid = indexSagaSeeds(sagas);
  const accumulators = new Map<string, Accumulator>();

  function touch(kind: CollectionKind, raw: string, game: CollectionGame): Accumulator | null {
    const resolved = resolveName(kind, raw);
    if (!resolved) return null;
    const id = `${kind}:${resolved.key}`;
    let acc = accumulators.get(id);
    if (!acc) {
      acc = { kind, spellings: new Map(), members: new Map(), groups: new Set() };
      accumulators.set(id, acc);
    }
    if (resolved.display) acc.override = resolved.display;
    acc.spellings.set(resolved.spelling, (acc.spellings.get(resolved.spelling) ?? 0) + 1);
    acc.groups.add(groupKeyOf(game));
    return acc;
  }

  for (const game of games) {
    if (isExcludedTitle(game.title, game.platform)) continue;
    const meta = metaByGame.get(game.id);

    // Franchises: the store wins; title and published sagas only apply where the store gave no key.
    for (const raw of meta?.franchises ?? []) {
      const acc = touch('franchise', raw, game);
      if (acc) acc.members.set(game.id, { gameId: game.id, source: 'store' });
    }
    const inferred = franchisesFromTitle(game.title);
    const saga = game.platform === 'steam' ? sagaByAppid.get(game.externalId) : undefined;
    for (const raw of saga ? [...inferred, saga] : inferred) {
      const acc = touch('franchise', raw, game);
      if (acc && !acc.members.has(game.id)) acc.members.set(game.id, { gameId: game.id, source: 'title' });
    }

    // Companies: devs and pubs become a single collection; the role accumulates.
    const credits = [
      ...(meta?.developers ?? []).map((raw) => ({ raw, role: 'dev' as const })),
      ...(meta?.publishers ?? []).map((raw) => ({ raw, role: 'pub' as const })),
    ];
    for (const { raw, role } of credits) {
      const acc = touch('company', raw, game);
      if (!acc) continue;
      const existing = acc.members.get(game.id);
      acc.members.set(game.id, { gameId: game.id, role: mergeRole(existing?.role, role), source: 'store' });
    }
  }

  const franchises: AutoCollection[] = [];
  const companies: AutoCollection[] = [];
  for (const [id, acc] of accumulators) {
    if (acc.groups.size < MIN_GROUPS_PER_COLLECTION) continue;
    const collection: AutoCollection = {
      id,
      kind: acc.kind,
      name: acc.override ?? mostFrequentSpelling(acc.spellings),
      members: [...acc.members.values()].sort((a, b) => a.gameId - b.gameId),
      groupCount: acc.groups.size,
    };
    (acc.kind === 'franchise' ? franchises : companies).push(collection);
  }

  const byCount = (a: AutoCollection, b: AutoCollection) =>
    b.groupCount - a.groupCount || a.name.localeCompare(b.name);
  return { franchises: franchises.sort(byCount), companies: companies.sort(byCount) };
}
