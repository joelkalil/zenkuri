import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ApiAchievement, ApiGame, CompletionHistoryItem, Platform, PlanningRecord, StoredCredential } from './types';
import { achievementMediaUrl, coverMediaUrl, heroMediaUrl, iconMediaUrl, portraitMediaUrl } from './mediaPaths';

const dbPath = process.env.ZENKURI_DB_PATH ?? join(process.cwd(), 'data', 'zenkuri.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  create table if not exists credentials (
    platform text primary key,
    data text not null,
    updated_at text not null
  );

  create table if not exists game_groups (
    id integer primary key autoincrement,
    normalized_title text not null unique,
    display_title text not null,
    created_at text not null,
    updated_at text not null
  );

  create table if not exists games (
    id integer primary key autoincrement,
    platform text not null,
    external_id text not null,
    title text not null,
    cover_url text,
    icon_url text,
    playtime_minutes integer not null default 0,
    recent_playtime_minutes integer,
    has_achievements integer not null default 0,
    metadata_json text not null default '{}',
    last_synced_at text not null,
    unique(platform, external_id)
  );

  create table if not exists achievements (
    id integer primary key autoincrement,
    game_id integer not null references games(id) on delete cascade,
    external_id text not null,
    title text not null,
    description text,
    icon_url text,
    locked_icon_url text,
    hidden integer not null default 0,
    display_order integer not null default 0,
    points integer,
    type text,
    metadata_json text not null default '{}',
    unique(game_id, external_id)
  );

  create table if not exists achievement_status (
    achievement_id integer primary key references achievements(id) on delete cascade,
    achieved integer not null default 0,
    unlock_time integer not null default 0,
    metadata_json text not null default '{}'
  );

  create table if not exists planning (
    game_id integer primary key references games(id) on delete cascade,
    in_backlog integer not null default 0,
    backlog_order integer,
    pinned integer not null default 0,
    dropped integer not null default 0,
    note text not null default '',
    effort text,
    schedule text,
    guide_url text not null default ''
  );

  create table if not exists sync_runs (
    id integer primary key autoincrement,
    platform text not null,
    started_at text not null,
    finished_at text,
    status text not null,
    message text
  );

  create view if not exists game_common_view as
    select
      g.id as game_id,
      g.group_id,
      g.platform,
      g.external_id,
      g.title,
      count(a.id) as total_items,
      sum(case when s.achieved = 1 then 1 else 0 end) as unlocked_items,
      case
        when count(a.id) = 0 then 0
        else round((sum(case when s.achieved = 1 then 1 else 0 end) * 100.0) / count(a.id))
      end as completion_percent
    from games g
    left join achievements a on a.game_id = g.id
    left join achievement_status s on s.achievement_id = a.id
    group by g.id;

  create view if not exists psn_trophy_view as
    select
      id as game_id,
      title,
      json_extract(metadata_json, '$.earnedTrophies.platinum') as earned_platinum,
      json_extract(metadata_json, '$.definedTrophies.platinum') as total_platinum,
      json_extract(metadata_json, '$.earnedTrophies.gold') as earned_gold,
      json_extract(metadata_json, '$.definedTrophies.gold') as total_gold,
      json_extract(metadata_json, '$.earnedTrophies.silver') as earned_silver,
      json_extract(metadata_json, '$.definedTrophies.silver') as total_silver,
      json_extract(metadata_json, '$.earnedTrophies.bronze') as earned_bronze,
      json_extract(metadata_json, '$.definedTrophies.bronze') as total_bronze
    from games
    where platform = 'psn';

  create view if not exists retroachievements_view as
    select
      id as game_id,
      title,
      json_extract(metadata_json, '$.numAwardedHardcore') as hardcore_unlocked,
      json_extract(metadata_json, '$.maxPossible') as hardcore_total,
      json_extract(metadata_json, '$.consoleName') as console_name
    from games
    where platform = 'retroachievements';
`);

function hasColumn(table: string, column: string) {
  return (db.prepare(`pragma table_info(${table})`).all() as any[])
    .some((row) => row.name === column);
}

if (!hasColumn('games', 'group_id')) {
  db.prepare('alter table games add column group_id integer').run();
}

if (!hasColumn('planning', 'dropped')) {
  db.prepare('alter table planning add column dropped integer not null default 0').run();
}

function now() {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTitle(title: string) {
  return title
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(director'?s cut|complete edition|definitive edition|game of the year|goty|enhanced edition|remastered|remake)\b/gi, '')
    .replace(/\s*[:|-]\s*$/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function upsertGameGroup(title: string) {
  const normalizedTitle = normalizeTitle(title);
  const displayTitle = title.replace(/[™®©]/g, '').trim();
  db.prepare(`
    insert into game_groups (normalized_title, display_title, created_at, updated_at)
    values (@normalizedTitle, @displayTitle, @now, @now)
    on conflict(normalized_title) do update set
      display_title = case
        when length(excluded.display_title) < length(game_groups.display_title) then excluded.display_title
        else game_groups.display_title
      end,
      updated_at = excluded.updated_at
  `).run({ normalizedTitle, displayTitle, now: now() });
  return db.prepare('select id, display_title as displayTitle, normalized_title as normalizedTitle from game_groups where normalized_title = ?')
    .get(normalizedTitle) as { id: number; displayTitle: string; normalizedTitle: string };
}

export function getCredential(platform: Platform): StoredCredential | null {
  const row = db.prepare('select * from credentials where platform = ?').get(platform) as any;
  if (!row) return null;
  return { platform, data: parseJson(row.data, {}), updatedAt: row.updated_at };
}

export function setCredential(platform: Platform, data: Record<string, unknown>) {
  db.prepare(`
    insert into credentials (platform, data, updated_at)
    values (@platform, @data, @updatedAt)
    on conflict(platform) do update set data = excluded.data, updated_at = excluded.updated_at
  `).run({ platform, data: JSON.stringify(data), updatedAt: now() });
}

export function deleteCredential(platform: Platform) {
  db.prepare('delete from credentials where platform = ?').run(platform);
}

export function listConfiguredPlatforms() {
  return (db.prepare('select platform, updated_at from credentials order by platform').all() as any[])
    .map((row) => ({ platform: row.platform as Platform, updatedAt: row.updated_at as string }));
}

export function upsertGame(input: {
  platform: Platform;
  externalId: string;
  title: string;
  coverUrl?: string;
  iconUrl?: string;
  playtimeMinutes?: number;
  recentPlaytimeMinutes?: number | null;
  hasAchievements?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const group = upsertGameGroup(input.title);
  db.prepare(`
    insert into games (
      platform, external_id, group_id, title, cover_url, icon_url, playtime_minutes,
      recent_playtime_minutes, has_achievements, metadata_json, last_synced_at
    )
    values (
      @platform, @externalId, @groupId, @title, @coverUrl, @iconUrl, @playtimeMinutes,
      @recentPlaytimeMinutes, @hasAchievements, @metadata, @lastSyncedAt
    )
    on conflict(platform, external_id) do update set
      group_id = excluded.group_id,
      title = excluded.title,
      cover_url = excluded.cover_url,
      icon_url = excluded.icon_url,
      playtime_minutes = excluded.playtime_minutes,
      recent_playtime_minutes = excluded.recent_playtime_minutes,
      has_achievements = excluded.has_achievements,
      metadata_json = excluded.metadata_json,
      last_synced_at = excluded.last_synced_at
  `).run({
    platform: input.platform,
    externalId: input.externalId,
    groupId: group.id,
    title: input.title,
    coverUrl: input.coverUrl ?? '',
    iconUrl: input.iconUrl ?? '',
    playtimeMinutes: input.playtimeMinutes ?? 0,
    recentPlaytimeMinutes: input.recentPlaytimeMinutes ?? null,
    hasAchievements: input.hasAchievements ? 1 : 0,
    metadata: JSON.stringify(input.metadata ?? {}),
    lastSyncedAt: now(),
  });

  return db.prepare('select id from games where platform = ? and external_id = ?')
    .get(input.platform, input.externalId) as { id: number };
}

export function backfillGameGroups() {
  const rows = db.prepare('select id, title from games').all() as { id: number; title: string }[];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const group = upsertGameGroup(row.title);
      db.prepare('update games set group_id = ? where id = ?').run(group.id, row.id);
    }
  });
  tx();
}

export function upsertAchievement(input: {
  gameId: number;
  externalId: string;
  title: string;
  description?: string;
  iconUrl?: string;
  lockedIconUrl?: string;
  hidden?: boolean;
  displayOrder?: number;
  points?: number | null;
  type?: string;
  achieved?: boolean;
  unlockTime?: number;
  metadata?: Record<string, unknown>;
  statusMetadata?: Record<string, unknown>;
}) {
  db.prepare(`
    insert into achievements (
      game_id, external_id, title, description, icon_url, locked_icon_url,
      hidden, display_order, points, type, metadata_json
    )
    values (
      @gameId, @externalId, @title, @description, @iconUrl, @lockedIconUrl,
      @hidden, @displayOrder, @points, @type, @metadata
    )
    on conflict(game_id, external_id) do update set
      title = excluded.title,
      description = excluded.description,
      icon_url = excluded.icon_url,
      locked_icon_url = excluded.locked_icon_url,
      hidden = excluded.hidden,
      display_order = excluded.display_order,
      points = excluded.points,
      type = excluded.type,
      metadata_json = excluded.metadata_json
  `).run({
    gameId: input.gameId,
    externalId: input.externalId,
    title: input.title,
    description: input.description ?? '',
    iconUrl: input.iconUrl ?? '',
    lockedIconUrl: input.lockedIconUrl ?? input.iconUrl ?? '',
    hidden: input.hidden ? 1 : 0,
    displayOrder: input.displayOrder ?? 0,
    points: input.points ?? null,
    type: input.type ?? '',
    metadata: JSON.stringify(input.metadata ?? {}),
  });

  const row = db.prepare('select id from achievements where game_id = ? and external_id = ?')
    .get(input.gameId, input.externalId) as { id: number };

  db.prepare(`
    insert into achievement_status (achievement_id, achieved, unlock_time, metadata_json)
    values (@achievementId, @achieved, @unlockTime, @metadata)
    on conflict(achievement_id) do update set
      achieved = excluded.achieved,
      unlock_time = excluded.unlock_time,
      metadata_json = excluded.metadata_json
  `).run({
    achievementId: row.id,
    achieved: input.achieved ? 1 : 0,
    unlockTime: input.unlockTime ?? 0,
    metadata: JSON.stringify(input.statusMetadata ?? {}),
  });
}

export function refreshGameAchievementFlag(gameId: number) {
  const total = db.prepare('select count(*) as count from achievements where game_id = ?')
    .get(gameId) as { count: number };
  db.prepare('update games set has_achievements = ? where id = ?').run(total.count > 0 ? 1 : 0, gameId);
}

export function listGames(platform?: Platform): ApiGame[] {
  backfillGameGroups();
  const rows = (platform
    ? db.prepare(`
        select g.*, gg.display_title as group_title, gg.normalized_title
        from games g
        left join game_groups gg on gg.id = g.group_id
        where g.platform = ?
        order by g.title collate nocase
      `).all(platform)
    : db.prepare(`
        select g.*, gg.display_title as group_title, gg.normalized_title
        from games g
        left join game_groups gg on gg.id = g.group_id
        order by g.platform, g.title collate nocase
      `).all()) as any[];

  const progressStmt = db.prepare(`
    select
      count(a.id) as total,
      sum(case when s.achieved = 1 then 1 else 0 end) as unlocked
    from achievements a
    left join achievement_status s on s.achievement_id = a.id
    where a.game_id = ?
  `);
  const relatedStmt = db.prepare(`
    select distinct platform
    from games
    where group_id = ? and id != ?
    order by platform
  `);

  return rows.map((row) => {
    const progress = progressStmt.get(row.id) as { total: number; unlocked: number | null };
    const metadata = parseJson<Record<string, any>>(row.metadata_json, {});
    let total = Number(progress.total ?? 0);
    let unlocked = Number(progress.unlocked ?? 0);
    let percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    if (row.platform === 'psn') {
      const defined = metadata.definedTrophies ?? {};
      const earned = metadata.earnedTrophies ?? {};
      const metadataTotal = Number(defined.bronze ?? 0) + Number(defined.silver ?? 0) + Number(defined.gold ?? 0) + Number(defined.platinum ?? 0);
      const metadataUnlocked = Number(earned.bronze ?? 0) + Number(earned.silver ?? 0) + Number(earned.gold ?? 0) + Number(earned.platinum ?? 0);
      if (total === 0) {
        total = metadataTotal;
        unlocked = metadataUnlocked;
      }
      percent = Number(metadata.progress ?? (total > 0 ? Math.round((unlocked / total) * 100) : 0));
    }

    if (total === 0 && row.platform === 'retroachievements') {
      total = Number(metadata.maxPossible ?? 0);
      unlocked = Number(metadata.numAwardedHardcore ?? metadata.numAwarded ?? 0);
      percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    }

    return {
      id: row.id,
      appid: row.id,
      groupId: row.group_id ?? row.id,
      groupName: row.group_title ?? row.title,
      normalizedTitle: row.normalized_title ?? normalizeTitle(row.title),
      platform: row.platform,
      platformGameId: row.external_id,
      name: row.title,
      coverUrl: coverMediaUrl(row.platform, row.external_id, row.title),
      portraitUrl: portraitMediaUrl(row.platform, row.external_id, row.title),
      heroUrl: heroMediaUrl(row.platform, row.external_id, row.title),
      playtime_forever: row.playtime_minutes ?? 0,
      playtime_2weeks: row.recent_playtime_minutes ?? undefined,
      img_icon_url: row.icon_url ? iconMediaUrl(row.platform, row.external_id, row.title) : '',
      has_community_visible_stats: Boolean(row.has_achievements) || total > 0,
      completion: {
        total,
        unlocked,
        percent,
      },
      metadata,
      relatedPlatforms: (relatedStmt.all(row.group_id, row.id) as { platform: Platform }[]).map((item) => item.platform),
    };
  });
}

export function getGameById(id: number) {
  return db.prepare('select * from games where id = ?').get(id) as any | undefined;
}

/**
 * Percentual global de jogadores que possuem a conquista (0–100), quando a
 * plataforma fornece: PSN traz trophyEarnedRate no status, Steam grava
 * globalPercent no metadata (sync), RA deriva de numAwarded / players do set.
 */
function extractRarity(
  platform: Platform,
  achievementMeta: Record<string, any>,
  statusMeta: Record<string, any>,
): number | null {
  if (platform === 'psn') {
    const rate = Number(statusMeta?.trophyEarnedRate ?? achievementMeta?.trophyEarnedRate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  if (platform === 'steam') {
    const percent = Number(achievementMeta?.globalPercent);
    return Number.isFinite(percent) && percent > 0 ? percent : null;
  }
  const awarded = Number(achievementMeta?.numAwardedHardcore ?? achievementMeta?.numAwarded);
  const players = Number(achievementMeta?.numDistinctPlayers);
  if (Number.isFinite(awarded) && Number.isFinite(players) && players > 0 && awarded > 0) {
    return Math.round((awarded / players) * 1000) / 10;
  }
  return null;
}

export function listAchievements(gameId: number): ApiAchievement[] {
  const game = db.prepare('select platform, external_id, title from games where id = ?')
    .get(gameId) as { platform: Platform; external_id: string; title: string } | undefined;
  const rows = db.prepare(`
    select a.*, s.achieved, s.unlock_time, s.metadata_json as status_metadata_json
    from achievements a
    left join achievement_status s on s.achievement_id = a.id
    where a.game_id = ?
    order by s.achieved desc, s.unlock_time desc, a.display_order asc, a.title collate nocase
  `).all(gameId) as any[];

  return rows.map((row) => {
    const icon = game && row.icon_url
      ? achievementMediaUrl(game.platform, game.external_id, game.title, row.external_id, row.title, false)
      : '';
    const lockedSource = row.locked_icon_url || row.icon_url;
    const icongray = game && lockedSource
      ? achievementMediaUrl(game.platform, game.external_id, game.title, row.external_id, row.title, row.locked_icon_url ? true : false)
      : icon;
    const rarity = game
      ? extractRarity(game.platform, parseJson(row.metadata_json, {}), parseJson(row.status_metadata_json, {}))
      : null;
    return {
      name: row.external_id,
      displayName: row.title,
      description: row.description ?? '',
      icon,
      icongray,
      hidden: row.hidden ? 1 : 0,
      achieved: Boolean(row.achieved),
      unlocktime: row.unlock_time ?? 0,
      points: row.points ?? undefined,
      type: row.type ?? undefined,
      rarity,
    };
  });
}

export interface UnlockItem {
  unlockTime: number;
  platform: Platform;
  gameId: number;
  gameName: string;
  achievementTitle: string;
  type: string | null;
  rarity: number | null;
  icon: string;
}

/** Anos (UTC) com pelo menos um desbloqueio registrado, mais recente primeiro. */
export function listUnlockYears(): number[] {
  return (db.prepare(`
    select distinct strftime('%Y', unlock_time, 'unixepoch') as year
    from achievement_status
    where achieved = 1 and unlock_time > 0
    order by year desc
  `).all() as { year: string }[]).map((row) => Number(row.year));
}

/** Todos os desbloqueios de um ano, ordem cronológica, com raridade quando disponível. */
export function listUnlocks(year: number): UnlockItem[] {
  const rows = db.prepare(`
    select
      s.unlock_time, s.metadata_json as status_metadata_json,
      a.metadata_json as achievement_metadata_json, a.title as achievement_title,
      a.external_id as achievement_external_id, a.type, a.icon_url,
      g.id as game_id, g.title as game_title, g.platform, g.external_id as game_external_id
    from achievement_status s
    join achievements a on a.id = s.achievement_id
    join games g on g.id = a.game_id
    where s.achieved = 1 and s.unlock_time > 0
      and strftime('%Y', s.unlock_time, 'unixepoch') = ?
    order by s.unlock_time asc
  `).all(String(year)) as any[];

  return rows.map((row) => ({
    unlockTime: row.unlock_time,
    platform: row.platform as Platform,
    gameId: row.game_id,
    gameName: row.game_title,
    achievementTitle: row.achievement_title,
    type: row.type || null,
    rarity: extractRarity(
      row.platform,
      parseJson(row.achievement_metadata_json, {}),
      parseJson(row.status_metadata_json, {}),
    ),
    icon: row.icon_url
      ? achievementMediaUrl(row.platform, row.game_external_id, row.game_title, row.achievement_external_id, row.achievement_title, false)
      : '',
  }));
}

/** Conquistas desbloqueadas mais raras da coleção inteira (raridade crescente). */
export function listRarestUnlocked(limit = 3): UnlockItem[] {
  const rows = db.prepare(`
    select
      s.unlock_time, s.metadata_json as status_metadata_json,
      a.metadata_json as achievement_metadata_json, a.title as achievement_title,
      a.external_id as achievement_external_id, a.type, a.icon_url,
      g.id as game_id, g.title as game_title, g.platform, g.external_id as game_external_id
    from achievement_status s
    join achievements a on a.id = s.achievement_id
    join games g on g.id = a.game_id
    where s.achieved = 1
  `).all() as any[];

  const withRarity = rows.flatMap((row) => {
    const rarity = extractRarity(
      row.platform,
      parseJson(row.achievement_metadata_json, {}),
      parseJson(row.status_metadata_json, {}),
    );
    if (rarity === null) return [];
    return [{
      unlockTime: row.unlock_time,
      platform: row.platform as Platform,
      gameId: row.game_id,
      gameName: row.game_title,
      achievementTitle: row.achievement_title,
      type: row.type || null,
      rarity,
      icon: row.icon_url
        ? achievementMediaUrl(row.platform, row.game_external_id, row.game_title, row.achievement_external_id, row.achievement_title, false)
        : '',
    }];
  });

  return withRarity.sort((a, b) => a.rarity! - b.rarity!).slice(0, limit);
}

export function listCompletionHistory(limit = 8): { platinums: CompletionHistoryItem[]; perfects: CompletionHistoryItem[] } {
  const games = new Map(listGames().map((game) => [game.id, game]));

  const platinumRows = db.prepare(`
    select g.id as game_id, max(s.unlock_time) as completed_at
    from games g
    join achievements a on a.game_id = g.id
    join achievement_status s on s.achievement_id = a.id
    where g.platform = 'psn'
      and lower(coalesce(a.type, '')) = 'platinum'
      and s.achieved = 1
      and s.unlock_time > 0
    group by g.id
    order by completed_at desc
    limit ?
  `).all(limit) as { game_id: number; completed_at: number }[];

  const perfectRows = db.prepare(`
    select g.id as game_id, max(s.unlock_time) as completed_at
    from games g
    join achievements a on a.game_id = g.id
    left join achievement_status s on s.achievement_id = a.id
    where g.platform != 'psn'
    group by g.id
    having count(a.id) > 0
      and sum(case when s.achieved = 1 then 1 else 0 end) = count(a.id)
      and completed_at > 0
    order by completed_at desc
    limit ?
  `).all(limit) as { game_id: number; completed_at: number }[];

  const mapRows = (rows: { game_id: number; completed_at: number }[], kind: CompletionHistoryItem['kind']) =>
    rows.flatMap((row) => {
      const game = games.get(row.game_id);
      return game ? [{ game, completedAt: row.completed_at, kind }] : [];
    });

  return {
    platinums: mapRows(platinumRows, 'platinum'),
    perfects: mapRows(perfectRows, 'perfect'),
  };
}

export function readPlanning(): PlanningRecord {
  const rows = db.prepare('select * from planning').all() as any[];
  const result: PlanningRecord = { backlog: [], pinned: [], dropped: [], notes: {}, effort: {}, schedule: {}, guides: {} };
  for (const row of rows) {
    const id = String(row.game_id);
    if (row.in_backlog) result.backlog.push(id);
    if (row.pinned) result.pinned.push(id);
    if (row.dropped) result.dropped.push(id);
    if (row.note) result.notes[id] = row.note;
    if (row.effort) result.effort[id] = row.effort;
    if (row.schedule) result.schedule[id] = row.schedule;
    if (row.guide_url) result.guides[id] = row.guide_url;
  }
  result.backlog.sort((a, b) => {
    const ar = rows.find((row) => String(row.game_id) === a)?.backlog_order ?? 999999;
    const br = rows.find((row) => String(row.game_id) === b)?.backlog_order ?? 999999;
    return ar - br;
  });
  return result;
}

export function patchPlanning(gameId: number, patch: Partial<{
  inBacklog: boolean;
  pinned: boolean;
  dropped: boolean;
  note: string;
  effort: string | null;
  schedule: string;
  guideUrl: string;
  backlogOrder: number | null;
}>) {
  db.prepare('insert or ignore into planning (game_id) values (?)').run(gameId);
  const sets: string[] = [];
  const params: Record<string, unknown> = { gameId };
  if ('inBacklog' in patch) { sets.push('in_backlog = @inBacklog'); params.inBacklog = patch.inBacklog ? 1 : 0; }
  if ('pinned' in patch) { sets.push('pinned = @pinned'); params.pinned = patch.pinned ? 1 : 0; }
  if ('dropped' in patch) { sets.push('dropped = @dropped'); params.dropped = patch.dropped ? 1 : 0; }
  if ('note' in patch) { sets.push('note = @note'); params.note = patch.note ?? ''; }
  if ('effort' in patch) { sets.push('effort = @effort'); params.effort = patch.effort ?? null; }
  if ('schedule' in patch) { sets.push('schedule = @schedule'); params.schedule = patch.schedule ?? ''; }
  if ('guideUrl' in patch) { sets.push('guide_url = @guideUrl'); params.guideUrl = patch.guideUrl ?? ''; }
  if ('backlogOrder' in patch) { sets.push('backlog_order = @backlogOrder'); params.backlogOrder = patch.backlogOrder ?? null; }
  if (sets.length > 0) db.prepare(`update planning set ${sets.join(', ')} where game_id = @gameId`).run(params);
  return readPlanning();
}

export function reorderBacklog(ids: string[]) {
  const tx = db.transaction(() => {
    ids.forEach((id, index) => patchPlanning(Number(id), { inBacklog: true, backlogOrder: index }));
  });
  tx();
  return readPlanning();
}

export function listSyncRuns(limit = 12) {
  return (db.prepare('select id, platform, started_at, finished_at, status, message from sync_runs order by id desc limit ?')
    .all(limit) as any[])
    .map((row) => ({
      id: row.id as number,
      platform: row.platform as Platform,
      startedAt: row.started_at as string,
      finishedAt: row.finished_at as string | null,
      status: row.status as string,
      message: row.message as string | null,
    }));
}

/** Latest sync run per platform (for the connection/status panels). */
export function latestSyncByPlatform() {
  const rows = db.prepare(`
    select platform, max(started_at) as started_at, status, finished_at
    from sync_runs group by platform
  `).all() as any[];
  const map: Record<string, { startedAt: string; status: string; finishedAt: string | null }> = {};
  for (const row of rows) map[row.platform] = { startedAt: row.started_at, status: row.status, finishedAt: row.finished_at };
  return map;
}

export function resetPlanning(scope: 'all' | 'notes' | 'backlog') {
  if (scope === 'all') db.prepare('delete from planning').run();
  else if (scope === 'notes') db.prepare("update planning set note = ''").run();
  else if (scope === 'backlog') db.prepare('update planning set in_backlog = 0, backlog_order = null').run();
}

export function importPlanning(record: Partial<PlanningRecord>) {
  const tx = db.transaction(() => {
    db.prepare('delete from planning').run();
    (record.backlog ?? []).forEach((id, index) => patchPlanning(Number(id), { inBacklog: true, backlogOrder: index }));
    (record.pinned ?? []).forEach((id) => patchPlanning(Number(id), { pinned: true }));
    (record.dropped ?? []).forEach((id) => patchPlanning(Number(id), { dropped: true }));
    Object.entries(record.notes ?? {}).forEach(([id, note]) => patchPlanning(Number(id), { note }));
    Object.entries(record.effort ?? {}).forEach(([id, effort]) => patchPlanning(Number(id), { effort }));
    Object.entries(record.schedule ?? {}).forEach(([id, schedule]) => patchPlanning(Number(id), { schedule }));
    Object.entries(record.guides ?? {}).forEach(([id, guideUrl]) => patchPlanning(Number(id), { guideUrl }));
  });
  tx();
  return readPlanning();
}

export function createSyncRun(platform: Platform) {
  const run = db.prepare('insert into sync_runs (platform, started_at, status) values (?, ?, ?)')
    .run(platform, now(), 'running');
  return Number(run.lastInsertRowid);
}

export function finishSyncRun(id: number, status: 'success' | 'error', message?: string) {
  db.prepare('update sync_runs set finished_at = ?, status = ?, message = ? where id = ?')
    .run(now(), status, message ?? '', id);
}
