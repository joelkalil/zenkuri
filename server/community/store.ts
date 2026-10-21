/*
  Database access for community spaces and publications.
  These are global tables (no user_id): every user reads the same content.
*/

import { db, parseJson } from '../db';
import type {
  CommunitySpace,
  Publication,
  PublicationKind,
  PublicationSummary,
  RankingPayload,
  SagaPayload,
} from '../../src/types/community';
import type { PackLanguage } from './language';
import { validateSagaPayload } from './schema';
import type { LoadedPublication, LoadedSpace } from './packs';

/** What /api/community/* returns: the shared types plus the pack language. */
export type SpaceView = CommunitySpace & { language: PackLanguage };
export type PublicationSummaryView = PublicationSummary & { language: PackLanguage };
export type PublicationView = Publication & { language: PackLanguage };

interface SpaceRow {
  id: number;
  slug: string;
  language: PackLanguage;
  name: string;
  description: string;
  source: string;
  updated_at: string;
  publication_count?: number;
}

interface PublicationRow {
  space_slug: string;
  language: PackLanguage;
  kind: PublicationKind;
  slug: string;
  title: string;
  summary: string;
  author_handle: string;
  author_name: string;
  version: number;
  published_at: string;
  payload_json?: string;
  source?: string;
  origin?: string;
  content_hash?: string;
  imported_at?: string;
}

function mapSummary(row: PublicationRow): PublicationSummaryView {
  return {
    space: row.space_slug,
    language: row.language,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    author: { handle: row.author_handle, name: row.author_name },
    version: row.version,
    publishedAt: row.published_at,
  };
}

const SUMMARY_COLUMNS = `
  s.slug as space_slug, p.language, p.kind, p.slug, p.title, p.summary,
  p.author_handle, p.author_name, p.version, p.published_at
`;

export function listSpaces(): SpaceView[] {
  const rows = db.prepare(`
    select s.id, s.slug, s.language, s.name, s.description, s.source, s.updated_at,
      (select count(*) from publications p where p.space_id = s.id) as publication_count
    from spaces s
    order by s.name collate nocase
  `).all() as SpaceRow[];
  return rows.map((row): SpaceView => ({
    slug: row.slug,
    language: row.language,
    name: row.name,
    description: row.description,
    source: row.source,
    updatedAt: row.updated_at,
    publicationCount: row.publication_count ?? 0,
  }));
}

export function listPublications(kind?: PublicationKind): PublicationSummaryView[] {
  const rows = db.prepare(`
    select ${SUMMARY_COLUMNS}
    from publications p join spaces s on s.id = p.space_id
    where (@kind is null or p.kind = @kind)
    order by s.slug, p.kind, p.title collate nocase
  `).all({ kind: kind ?? null }) as PublicationRow[];
  return rows.map(mapSummary);
}

export function getPublication(space: string, kind: PublicationKind, slug: string): PublicationView | null {
  const row = db.prepare(`
    select ${SUMMARY_COLUMNS}, p.payload_json, p.source, p.origin, p.content_hash, p.imported_at
    from publications p join spaces s on s.id = p.space_id
    where s.slug = ? and p.kind = ? and p.slug = ?
  `).get(space, kind, slug) as PublicationRow | undefined;
  if (!row) return null;
  const summary = mapSummary(row);
  const base = {
    ...summary,
    source: row.source ?? 'pack',
    origin: row.origin ?? '',
    contentHash: row.content_hash ?? '',
    importedAt: row.imported_at ?? '',
  };
  // The payload was validated on import; the JSON is only read here.
  if (row.kind === 'saga') return { ...base, kind: 'saga', payload: parseJson<SagaPayload>(row.payload_json, {} as SagaPayload) };
  return { ...base, kind: 'ranking', payload: parseJson<RankingPayload>(row.payload_json, { entries: [] }) };
}

/** Published sagas, revalidated on read; used to seed the franchise collections. */
export function listSagaPayloads(): Array<{ slug: string; payload: SagaPayload }> {
  const rows = db.prepare(`
    select p.slug, p.payload_json from publications p where p.kind = 'saga' order by p.slug
  `).all() as Array<{ slug: string; payload_json: string }>;
  const sagas: Array<{ slug: string; payload: SagaPayload }> = [];
  for (const row of rows) {
    const checked = validateSagaPayload(`publication:${row.slug}`, parseJson<unknown>(row.payload_json, null));
    if (checked.ok) sagas.push({ slug: row.slug, payload: checked.value });
  }
  return sagas;
}

// ─── Writing (pack import) ──────────────────────────────────────────

export interface PackSyncSummary {
  spaces: number;
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
}

/**
 * Syncs the database with the packs read, idempotently:
 * publications are compared by `content_hash` and only rewritten if they changed.
 * `seen*` (every file on disk, valid or not) protects publications whose pack
 * became invalid: only what disappeared from disk disappears from the database.
 */
export function syncPacksToDb(input: {
  spaces: readonly LoadedSpace[];
  publications: readonly LoadedPublication[];
  seenSpaces: ReadonlySet<string>;
  seenPublications: ReadonlySet<string>;
  /** with the root missing nothing is removed (avoids wiping everything over a wrong path) */
  allowRemoval: boolean;
  now?: string;
}): PackSyncSummary {
  const now = input.now ?? new Date().toISOString();
  const summary: PackSyncSummary = { spaces: input.spaces.length, added: 0, updated: 0, unchanged: 0, removed: 0 };

  const upsertSpace = db.prepare(`
    insert into spaces (slug, language, name, description, source, updated_at)
    values (@slug, @language, @name, @description, 'pack', @now)
    on conflict(slug) do update set
      language = excluded.language,
      name = excluded.name,
      description = excluded.description,
      source = 'pack',
      updated_at = case
        when spaces.name <> excluded.name or spaces.description <> excluded.description
          or spaces.language <> excluded.language then excluded.updated_at
        else spaces.updated_at
      end
  `);
  const spaceId = db.prepare('select id from spaces where slug = ?');
  const existing = db.prepare('select id, content_hash from publications where space_id = ? and kind = ? and slug = ?');
  const insert = db.prepare(`
    insert into publications
      (space_id, language, kind, slug, title, summary, author_handle, author_name, version, published_at,
       payload_json, source, origin, content_hash, imported_at)
    values
      (@spaceId, @language, @kind, @slug, @title, @summary, @authorHandle, @authorName, @version, @publishedAt,
       @payloadJson, 'pack', @origin, @contentHash, @now)
  `);
  const update = db.prepare(`
    update publications set
      language = @language, title = @title, summary = @summary, author_handle = @authorHandle, author_name = @authorName,
      version = @version, published_at = @publishedAt, payload_json = @payloadJson, source = 'pack',
      origin = @origin, content_hash = @contentHash, imported_at = @now
    where id = @id
  `);

  const run = db.transaction(() => {
    for (const space of input.spaces) {
      upsertSpace.run({ slug: space.slug, language: space.language, name: space.name, description: space.description, now });
    }

    for (const pub of input.publications) {
      const owner = spaceId.get(pub.space) as { id: number } | undefined;
      if (!owner) continue;
      const current = existing.get(owner.id, pub.kind, pub.slug) as { id: number; content_hash: string } | undefined;
      if (current?.content_hash === pub.contentHash) {
        summary.unchanged += 1;
        continue;
      }
      const params = {
        spaceId: owner.id,
        language: pub.language,
        kind: pub.kind,
        slug: pub.slug,
        title: pub.title,
        summary: pub.summary,
        authorHandle: pub.author.handle,
        authorName: pub.author.name,
        version: pub.version,
        publishedAt: pub.publishedAt,
        payloadJson: JSON.stringify(pub.payload),
        origin: pub.origin,
        contentHash: pub.contentHash,
        now,
      };
      if (current) {
        update.run({ ...params, id: current.id });
        summary.updated += 1;
      } else {
        insert.run(params);
        summary.added += 1;
      }
    }

    if (!input.allowRemoval) return;

    const stored = db.prepare(`
      select p.id, s.slug as space_slug, p.kind, p.slug
      from publications p join spaces s on s.id = p.space_id
      where p.source = 'pack'
    `).all() as Array<{ id: number; space_slug: string; kind: PublicationKind; slug: string }>;
    const deletePublication = db.prepare('delete from publications where id = ?');
    for (const row of stored) {
      if (input.seenPublications.has(`${row.space_slug}/${row.kind}/${row.slug}`)) continue;
      deletePublication.run(row.id);
      summary.removed += 1;
    }

    const deleteSpace = db.prepare('delete from spaces where id = ?');
    const storedSpaces = db.prepare("select id, slug from spaces where source = 'pack'").all() as Array<{ id: number; slug: string }>;
    for (const row of storedSpaces) {
      if (!input.seenSpaces.has(row.slug)) deleteSpace.run(row.id);
    }
  });
  run();
  return summary;
}
