import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { ApiAchievement, ApiGame, CompletionHistoryItem, Platform, PlanningRecord, StoredCredential } from './types';
import { achievementMediaUrl, coverMediaUrl, heroMediaUrl, iconMediaUrl, portraitMediaUrl } from './mediaPaths';

const dbPath = process.env.ZENKURI_DB_PATH ?? join(process.cwd(), 'data', 'zenkuri.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/*
  Schema v2 — multiusuário
  ────────────────────────
  Catálogo compartilhado: game_groups, games, achievements descrevem os jogos
  e seus sets de conquistas, independentes de quem sincronizou.
  Dados por usuário: user_games (posse + tempo de jogo + progresso agregado),
  user_achievements (status de desbloqueio), planning, user_platform_accounts
  (credenciais Steam/PSN/RA) e sync_runs referenciam users(id).
*/
db.exec(`
  create table if not exists users (
    id integer primary key autoincrement,
    username text not null collate nocase unique,
    display_name text not null,
    password_hash text not null,
    created_at text not null
  );

  create table if not exists sessions (
    token text primary key,
    user_id integer not null references users(id) on delete cascade,
    created_at text not null,
    expires_at text not null
  );

  create table if not exists user_platform_accounts (
    user_id integer not null references users(id) on delete cascade,
    platform text not null,
    data text not null,
    updated_at text not null,
    primary key (user_id, platform)
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

  create table if not exists user_games (
    user_id integer not null references users(id) on delete cascade,
    game_id integer not null references games(id) on delete cascade,
    playtime_minutes integer not null default 0,
    recent_playtime_minutes integer,
    progress_json text not null default '{}',
    last_synced_at text not null,
    primary key (user_id, game_id)
  );

  create table if not exists user_achievements (
    user_id integer not null references users(id) on delete cascade,
    achievement_id integer not null references achievements(id) on delete cascade,
    achieved integer not null default 0,
    unlock_time integer not null default 0,
    metadata_json text not null default '{}',
    primary key (user_id, achievement_id)
  );

  create table if not exists planning (
    user_id integer not null references users(id) on delete cascade,
    game_id integer not null references games(id) on delete cascade,
    in_backlog integer not null default 0,
    backlog_order integer,
    pinned integer not null default 0,
    dropped integer not null default 0,
    note text not null default '',
    effort text,
    schedule text,
    guide_url text not null default '',
    primary key (user_id, game_id)
  );

  create table if not exists sync_runs (
    id integer primary key autoincrement,
    platform text not null,
    started_at text not null,
    finished_at text,
    status text not null,
    message text
  );

  create index if not exists idx_user_achievements_user on user_achievements(user_id, achieved, unlock_time);
  create index if not exists idx_user_games_user on user_games(user_id);
  create index if not exists idx_achievements_game on achievements(game_id);
`);

function hasColumn(table: string, column: string) {
  return (db.prepare(`pragma table_info(${table})`).all() as any[])
    .some((row) => row.name === column);
}

function tableExists(table: string) {
  return Boolean(db.prepare("select name from sqlite_master where type = 'table' and name = ?").get(table));
}

if (!hasColumn('games', 'group_id')) {
  db.prepare('alter table games add column group_id integer').run();
}

if (!hasColumn('sync_runs', 'user_id')) {
  db.prepare('alter table sync_runs add column user_id integer').run();
}

function now() {
  return new Date().toISOString();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/*
  Migração v1 → v2: o banco single-user tinha credentials, achievement_status
  e planning sem dono. Todo o histórico é movido para um usuário legado
  (ZENKURI_LEGACY_USER / ZENKURI_LEGACY_PASSWORD, padrão joel / zenkuri —
  troque a senha após o primeiro login).
*/
function migrateToMultiUser() {
  const version = Number(db.pragma('user_version', { simple: true }));
  if (version >= 2) return;

  const hasLegacyData = tableExists('credentials') || tableExists('achievement_status')
    || (tableExists('planning') && !hasColumn('planning', 'user_id'));

  if (hasLegacyData && existsSync(dbPath)) {
    try {
      copyFileSync(dbPath, `${dbPath}.pre-v2.bak`);
    } catch {
      // backup é best-effort; a migração roda em transação de qualquer forma
    }
  }

  const tx = db.transaction(() => {
    // As views v1 referenciam achievement_status; precisam sair antes de
    // qualquer drop/rename para o SQLite não tentar revalidá-las.
    db.prepare('drop view if exists game_common_view').run();
    db.prepare('drop view if exists psn_trophy_view').run();
    db.prepare('drop view if exists retroachievements_view').run();

    let legacyUserId: number | null = null;

    if (hasLegacyData) {
      const username = process.env.ZENKURI_LEGACY_USER ?? 'joel';
      const password = process.env.ZENKURI_LEGACY_PASSWORD ?? 'zenkuri';
      const existing = db.prepare('select id from users where username = ?').get(username) as { id: number } | undefined;
      if (existing) {
        legacyUserId = existing.id;
      } else {
        const inserted = db.prepare(`
          insert into users (username, display_name, password_hash, created_at)
          values (?, ?, ?, ?)
        `).run(username, username.charAt(0).toUpperCase() + username.slice(1), hashPassword(password), now());
        legacyUserId = Number(inserted.lastInsertRowid);
        console.warn(`[zenkuri] Dados existentes migrados para o usuário "${username}" (senha inicial "${password}" — troque no perfil).`);
      }
    }

    if (legacyUserId !== null && tableExists('credentials')) {
      db.prepare(`
        insert or ignore into user_platform_accounts (user_id, platform, data, updated_at)
        select ?, platform, data, updated_at from credentials
      `).run(legacyUserId);
      db.prepare('drop table credentials').run();
    }

    if (legacyUserId !== null) {
      db.prepare(`
        insert or ignore into user_games (user_id, game_id, playtime_minutes, recent_playtime_minutes, progress_json, last_synced_at)
        select ?, id, playtime_minutes, recent_playtime_minutes, metadata_json, last_synced_at from games
      `).run(legacyUserId);
    }

    if (tableExists('achievement_status')) {
      if (legacyUserId !== null) {
        db.prepare(`
          insert or ignore into user_achievements (user_id, achievement_id, achieved, unlock_time, metadata_json)
          select ?, achievement_id, achieved, unlock_time, metadata_json from achievement_status
        `).run(legacyUserId);
      }
      db.prepare('drop table achievement_status').run();
    }

    if (tableExists('planning') && !hasColumn('planning', 'user_id')) {
      db.prepare('alter table planning rename to planning_legacy').run();
      db.prepare(`
        create table planning (
          user_id integer not null references users(id) on delete cascade,
          game_id integer not null references games(id) on delete cascade,
          in_backlog integer not null default 0,
          backlog_order integer,
          pinned integer not null default 0,
          dropped integer not null default 0,
          note text not null default '',
          effort text,
          schedule text,
          guide_url text not null default '',
          primary key (user_id, game_id)
        )
      `).run();
      if (legacyUserId !== null) {
        db.prepare(`
          insert or ignore into planning (user_id, game_id, in_backlog, backlog_order, pinned, dropped, note, effort, schedule, guide_url)
          select ?, game_id, in_backlog, backlog_order, pinned, dropped, note, effort, schedule, guide_url from planning_legacy
        `).run(legacyUserId);
      }
      db.prepare('drop table planning_legacy').run();
    }

    if (legacyUserId !== null) {
      db.prepare('update sync_runs set user_id = ? where user_id is null').run(legacyUserId);
    }

    db.pragma('user_version = 2');
  });
  tx();
}

migrateToMultiUser();

/*
  Migração v2 → v3: user_platform_accounts guarda apenas identificadores
  públicos. Remove API keys, NPSSO e tokens que possam ter vindo do schema
  single-user, além do antigo cache persistente de tokens PSN.
*/
function migrateServiceSecretsOutOfDatabase() {
  const version = Number(db.pragma('user_version', { simple: true }));
  if (version >= 3) return;

  const tx = db.transaction(() => {
    const rows = db.prepare('select user_id, platform, data, updated_at from user_platform_accounts').all() as Array<{
      user_id: number;
      platform: Platform;
      data: string;
      updated_at: string;
    }>;
    const update = db.prepare('update user_platform_accounts set data = ? where user_id = ? and platform = ?');
    const remove = db.prepare('delete from user_platform_accounts where user_id = ? and platform = ?');

    for (const row of rows) {
      const data = parseJson<Record<string, unknown>>(row.data, {});
      const verifiedAt = typeof data.verifiedAt === 'string' ? data.verifiedAt : row.updated_at;
      let safe: Record<string, unknown> | null = null;

      if (row.platform === 'steam' && data.steamid) {
        safe = { steamid: String(data.steamid), verified: Boolean(data.verified ?? true), verifiedAt };
      } else if (row.platform === 'retroachievements' && data.username) {
        safe = { username: String(data.username), verified: Boolean(data.verified ?? true), verifiedAt };
      } else if (row.platform === 'psn' && data.onlineId && data.accountId) {
        safe = {
          onlineId: String(data.onlineId),
          accountId: String(data.accountId),
          verified: Boolean(data.verified),
          ...(data.verified ? { verifiedAt } : {}),
          ...(!data.verified && data.code ? { code: String(data.code) } : {}),
        };
      }

      if (safe) update.run(JSON.stringify(safe), row.user_id, row.platform);
      else remove.run(row.user_id, row.platform);
    }

    db.prepare('drop table if exists service_state').run();
    db.pragma('user_version = 3');
  });
  tx();
}

migrateServiceSecretsOutOfDatabase();

/*
  Coleções manuais por usuário (franquias/séries): tabela própria + coluna
  collection_id em planning apontando para a coleção do jogo.
*/
db.exec(`
  create table if not exists collections (
    id integer primary key autoincrement,
    user_id integer not null references users(id) on delete cascade,
    name text not null
  );
`);

if (!hasColumn('planning', 'collection_id')) {
  db.prepare('alter table planning add column collection_id integer').run();
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
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
    .replace(/[̀-ͯ]/g, '')
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

// ─── Usuários e sessões ─────────────────────────────────────────────────────

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function createUser(username: string, displayName: string, passwordHash: string): UserRecord {
  const inserted = db.prepare(`
    insert into users (username, display_name, password_hash, created_at)
    values (?, ?, ?, ?)
  `).run(username, displayName, passwordHash, now());
  return getUserById(Number(inserted.lastInsertRowid))!;
}

export function getUserByUsername(username: string): UserRecord | null {
  const row = db.prepare('select * from users where username = ?').get(username) as any;
  return row ? mapUser(row) : null;
}

export function getUserById(id: number): UserRecord | null {
  const row = db.prepare('select * from users where id = ?').get(id) as any;
  return row ? mapUser(row) : null;
}

export function updateUserPassword(userId: number, passwordHash: string) {
  db.prepare('update users set password_hash = ? where id = ?').run(passwordHash, userId);
}

export function updateUserProfile(userId: number, displayName: string) {
  db.prepare('update users set display_name = ? where id = ?').run(displayName, userId);
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dias

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('hex');
  const created = Date.now();
  db.prepare('insert into sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)')
    .run(token, userId, new Date(created).toISOString(), new Date(created + SESSION_TTL_MS).toISOString());
  db.prepare('delete from sessions where expires_at < ?').run(now());
  return token;
}

export function getSessionUser(token: string): UserRecord | null {
  const row = db.prepare(`
    select u.* from sessions s
    join users u on u.id = s.user_id
    where s.token = ? and s.expires_at > ?
  `).get(token, now()) as any;
  return row ? mapUser(row) : null;
}

export function deleteSession(token: string) {
  db.prepare('delete from sessions where token = ?').run(token);
}

// ─── Contas de plataforma (por usuário) ─────────────────────────────────────

export function getCredential(userId: number, platform: Platform): StoredCredential | null {
  const row = db.prepare('select * from user_platform_accounts where user_id = ? and platform = ?')
    .get(userId, platform) as any;
  if (!row) return null;
  return { platform, data: parseJson(row.data, {}), updatedAt: row.updated_at };
}

export function setCredential(userId: number, platform: Platform, data: Record<string, unknown>) {
  db.prepare(`
    insert into user_platform_accounts (user_id, platform, data, updated_at)
    values (@userId, @platform, @data, @updatedAt)
    on conflict(user_id, platform) do update set data = excluded.data, updated_at = excluded.updated_at
  `).run({ userId, platform, data: JSON.stringify(data), updatedAt: now() });
}

export function deleteCredential(userId: number, platform: Platform) {
  db.prepare('delete from user_platform_accounts where user_id = ? and platform = ?').run(userId, platform);
}

export function listConfiguredPlatforms(userId: number) {
  return (db.prepare('select platform, data, updated_at from user_platform_accounts where user_id = ? order by platform').all(userId) as any[])
    .map((row) => ({
      platform: row.platform as Platform,
      updatedAt: row.updated_at as string,
      verified: Boolean(parseJson<Record<string, unknown>>(row.data, {}).verified),
    }));
}

// ─── Estado do serviço (tokens da conta de serviço, etc.) ───────────────────

// ─── Catálogo + posse ───────────────────────────────────────────────────────

export function upsertGame(userId: number, input: {
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
      platform, external_id, group_id, title, cover_url, icon_url,
      has_achievements, metadata_json, last_synced_at
    )
    values (
      @platform, @externalId, @groupId, @title, @coverUrl, @iconUrl,
      @hasAchievements, @metadata, @lastSyncedAt
    )
    on conflict(platform, external_id) do update set
      group_id = excluded.group_id,
      title = excluded.title,
      cover_url = excluded.cover_url,
      icon_url = excluded.icon_url,
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
    hasAchievements: input.hasAchievements ? 1 : 0,
    metadata: JSON.stringify(input.metadata ?? {}),
    lastSyncedAt: now(),
  });

  const game = db.prepare('select id from games where platform = ? and external_id = ?')
    .get(input.platform, input.externalId) as { id: number };

  db.prepare(`
    insert into user_games (user_id, game_id, playtime_minutes, recent_playtime_minutes, progress_json, last_synced_at)
    values (@userId, @gameId, @playtimeMinutes, @recentPlaytimeMinutes, @progress, @lastSyncedAt)
    on conflict(user_id, game_id) do update set
      playtime_minutes = excluded.playtime_minutes,
      recent_playtime_minutes = excluded.recent_playtime_minutes,
      progress_json = excluded.progress_json,
      last_synced_at = excluded.last_synced_at
  `).run({
    userId,
    gameId: game.id,
    playtimeMinutes: input.playtimeMinutes ?? 0,
    recentPlaytimeMinutes: input.recentPlaytimeMinutes ?? null,
    progress: JSON.stringify(input.metadata ?? {}),
    lastSyncedAt: now(),
  });

  return game;
}

export function backfillGameGroups() {
  const rows = db.prepare('select id, title from games where group_id is null').all() as { id: number; title: string }[];
  if (rows.length === 0) return;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const group = upsertGameGroup(row.title);
      db.prepare('update games set group_id = ? where id = ?').run(group.id, row.id);
    }
  });
  tx();
}

export function upsertAchievement(userId: number, input: {
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
    insert into user_achievements (user_id, achievement_id, achieved, unlock_time, metadata_json)
    values (@userId, @achievementId, @achieved, @unlockTime, @metadata)
    on conflict(user_id, achievement_id) do update set
      achieved = excluded.achieved,
      unlock_time = excluded.unlock_time,
      metadata_json = excluded.metadata_json
  `).run({
    userId,
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

export function listGames(userId: number, platform?: Platform): ApiGame[] {
  backfillGameGroups();
  const rows = (platform
    ? db.prepare(`
        select g.*, gg.display_title as group_title, gg.normalized_title,
          ug.playtime_minutes as user_playtime, ug.recent_playtime_minutes as user_recent_playtime,
          ug.progress_json
        from user_games ug
        join games g on g.id = ug.game_id
        left join game_groups gg on gg.id = g.group_id
        where ug.user_id = ? and g.platform = ?
        order by g.title collate nocase
      `).all(userId, platform)
    : db.prepare(`
        select g.*, gg.display_title as group_title, gg.normalized_title,
          ug.playtime_minutes as user_playtime, ug.recent_playtime_minutes as user_recent_playtime,
          ug.progress_json
        from user_games ug
        join games g on g.id = ug.game_id
        left join game_groups gg on gg.id = g.group_id
        where ug.user_id = ?
        order by g.platform, g.title collate nocase
      `).all(userId)) as any[];

  const progressStmt = db.prepare(`
    select
      count(a.id) as total,
      sum(case when ua.achieved = 1 then 1 else 0 end) as unlocked
    from achievements a
    left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ?
    where a.game_id = ?
  `);
  const relatedStmt = db.prepare(`
    select distinct g.platform
    from user_games ug
    join games g on g.id = ug.game_id
    where ug.user_id = ? and g.group_id = ? and g.id != ?
    order by g.platform
  `);

  return rows.map((row) => {
    const progress = progressStmt.get(userId, row.id) as { total: number; unlocked: number | null };
    // Progresso do usuário sobrepõe o metadata de catálogo (earnedTrophies, numAwarded…)
    const metadata = {
      ...parseJson<Record<string, any>>(row.metadata_json, {}),
      ...parseJson<Record<string, any>>(row.progress_json, {}),
    };
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
      playtime_forever: row.user_playtime ?? 0,
      playtime_2weeks: row.user_recent_playtime ?? undefined,
      img_icon_url: row.icon_url ? iconMediaUrl(row.platform, row.external_id, row.title) : '',
      has_community_visible_stats: Boolean(row.has_achievements) || total > 0,
      completion: {
        total,
        unlocked,
        percent,
      },
      metadata,
      relatedPlatforms: (relatedStmt.all(userId, row.group_id, row.id) as { platform: Platform }[]).map((item) => item.platform),
    };
  });
}

export function getGameById(id: number) {
  return db.prepare('select * from games where id = ?').get(id) as any | undefined;
}

/*
  Reconciliação de posse: uma sync de biblioteca só faz upsert dos jogos que a
  conta ainda tem. Esta função remove o que o usuário deixou de possuir naquela
  plataforma (ex.: SteamID trocado por outro), destacando user_games, o status
  de conquistas e o planning daqueles jogos. O catálogo compartilhado (games /
  achievements) permanece intacto para os demais usuários.

  `seenExternalIds` deve conter os external_id retornados pela sync atual. Se
  vier vazio (perfil privado, falha transitória da API), nada é removido — a
  chamadora deve pular a poda nesse caso para não apagar a biblioteca inteira.
*/
export function pruneUserGames(userId: number, platform: Platform, seenExternalIds: Iterable<string>): number {
  const seen = new Set<string>();
  for (const id of seenExternalIds) seen.add(String(id));
  if (seen.size === 0) return 0;

  const owned = db.prepare(`
    select g.id as id, g.external_id as externalId
    from user_games ug
    join games g on g.id = ug.game_id
    where ug.user_id = ? and g.platform = ?
  `).all(userId, platform) as { id: number; externalId: string }[];

  const stale = owned.filter((row) => !seen.has(String(row.externalId)));
  if (stale.length === 0) return 0;

  const delUserGame = db.prepare('delete from user_games where user_id = ? and game_id = ?');
  const delUserAchievements = db.prepare(`
    delete from user_achievements
    where user_id = ? and achievement_id in (select id from achievements where game_id = ?)
  `);
  const delPlanning = db.prepare('delete from planning where user_id = ? and game_id = ?');

  const tx = db.transaction(() => {
    for (const row of stale) {
      delUserAchievements.run(userId, row.id);
      delPlanning.run(userId, row.id);
      delUserGame.run(userId, row.id);
    }
  });
  tx();
  return stale.length;
}

export function userOwnsGame(userId: number, gameId: number) {
  return Boolean(db.prepare('select 1 from user_games where user_id = ? and game_id = ?').get(userId, gameId));
}

/**
 * Percentual global de jogadores que possuem a conquista (0–100), quando a
 * plataforma fornece: PSN traz trophyEarnedRate no status, Steam grava
 * globalPercent no metadata (sync), RA deriva de numAwarded / players do set.
 */
export function extractRarity(
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

export function listAchievements(userId: number, gameId: number): ApiAchievement[] {
  const game = db.prepare('select platform, external_id, title from games where id = ?')
    .get(gameId) as { platform: Platform; external_id: string; title: string } | undefined;
  const rows = db.prepare(`
    select a.*, ua.achieved, ua.unlock_time, ua.metadata_json as status_metadata_json
    from achievements a
    left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ?
    where a.game_id = ?
    order by ua.achieved desc, ua.unlock_time desc, a.display_order asc, a.title collate nocase
  `).all(userId, gameId) as any[];

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
export function listUnlockYears(userId: number): number[] {
  return (db.prepare(`
    select distinct strftime('%Y', unlock_time, 'unixepoch') as year
    from user_achievements
    where user_id = ? and achieved = 1 and unlock_time > 0
    order by year desc
  `).all(userId) as { year: string }[]).map((row) => Number(row.year));
}

/** Todos os desbloqueios de um ano, ordem cronológica, com raridade quando disponível. */
export function listUnlocks(userId: number, year: number): UnlockItem[] {
  const rows = db.prepare(`
    select
      ua.unlock_time, ua.metadata_json as status_metadata_json,
      a.metadata_json as achievement_metadata_json, a.title as achievement_title,
      a.external_id as achievement_external_id, a.type, a.icon_url,
      g.id as game_id, g.title as game_title, g.platform, g.external_id as game_external_id
    from user_achievements ua
    join achievements a on a.id = ua.achievement_id
    join games g on g.id = a.game_id
    where ua.user_id = ? and ua.achieved = 1 and ua.unlock_time > 0
      and strftime('%Y', ua.unlock_time, 'unixepoch') = ?
    order by ua.unlock_time asc
  `).all(userId, String(year)) as any[];

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
export function listRarestUnlocked(userId: number, limit = 3): UnlockItem[] {
  const rows = db.prepare(`
    select
      ua.unlock_time, ua.metadata_json as status_metadata_json,
      a.metadata_json as achievement_metadata_json, a.title as achievement_title,
      a.external_id as achievement_external_id, a.type, a.icon_url,
      g.id as game_id, g.title as game_title, g.platform, g.external_id as game_external_id
    from user_achievements ua
    join achievements a on a.id = ua.achievement_id
    join games g on g.id = a.game_id
    where ua.user_id = ? and ua.achieved = 1
  `).all(userId) as any[];

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

export function listCompletionHistory(userId: number, limit = 8): { platinums: CompletionHistoryItem[]; perfects: CompletionHistoryItem[] } {
  const games = new Map(listGames(userId).map((game) => [game.id, game]));

  const platinumRows = db.prepare(`
    select g.id as game_id, max(ua.unlock_time) as completed_at
    from games g
    join achievements a on a.game_id = g.id
    join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ?
    where g.platform = 'psn'
      and lower(coalesce(a.type, '')) = 'platinum'
      and ua.achieved = 1
      and ua.unlock_time > 0
    group by g.id
    order by completed_at desc
    limit ?
  `).all(userId, limit) as { game_id: number; completed_at: number }[];

  const perfectRows = db.prepare(`
    select g.id as game_id, max(ua.unlock_time) as completed_at
    from user_games ug
    join games g on g.id = ug.game_id
    join achievements a on a.game_id = g.id
    left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = ug.user_id
    where g.platform != 'psn' and ug.user_id = ?
    group by g.id
    having count(a.id) > 0
      and sum(case when ua.achieved = 1 then 1 else 0 end) = count(a.id)
      and completed_at > 0
    order by completed_at desc
    limit ?
  `).all(userId, limit) as { game_id: number; completed_at: number }[];

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

// ─── Planning (por usuário) ─────────────────────────────────────────────────

export function readPlanning(userId: number): PlanningRecord {
  const rows = db.prepare('select * from planning where user_id = ?').all(userId) as any[];
  const collections = db.prepare('select id, name from collections where user_id = ? order by name collate nocase')
    .all(userId) as { id: number; name: string }[];
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const result: PlanningRecord = {
    backlog: [], pinned: [], dropped: [], notes: {}, effort: {}, schedule: {}, guides: {},
    collections, collectionOf: {},
  };
  for (const row of rows) {
    const id = String(row.game_id);
    if (row.in_backlog) result.backlog.push(id);
    if (row.pinned) result.pinned.push(id);
    if (row.dropped) result.dropped.push(id);
    if (row.note) result.notes[id] = row.note;
    if (row.effort) result.effort[id] = row.effort;
    if (row.schedule) result.schedule[id] = row.schedule;
    if (row.guide_url) result.guides[id] = row.guide_url;
    if (row.collection_id && collectionIds.has(row.collection_id)) result.collectionOf[id] = row.collection_id;
  }
  result.backlog.sort((a, b) => {
    const ar = rows.find((row) => String(row.game_id) === a)?.backlog_order ?? 999999;
    const br = rows.find((row) => String(row.game_id) === b)?.backlog_order ?? 999999;
    return ar - br;
  });
  return result;
}

export function patchPlanning(userId: number, gameId: number, patch: Partial<{
  inBacklog: boolean;
  pinned: boolean;
  dropped: boolean;
  note: string;
  effort: string | null;
  schedule: string;
  guideUrl: string;
  backlogOrder: number | null;
  collectionId: number | null;
}>) {
  db.prepare('insert or ignore into planning (user_id, game_id) values (?, ?)').run(userId, gameId);
  const sets: string[] = [];
  const params: Record<string, unknown> = { userId, gameId };
  if ('inBacklog' in patch) { sets.push('in_backlog = @inBacklog'); params.inBacklog = patch.inBacklog ? 1 : 0; }
  if ('pinned' in patch) { sets.push('pinned = @pinned'); params.pinned = patch.pinned ? 1 : 0; }
  if ('dropped' in patch) { sets.push('dropped = @dropped'); params.dropped = patch.dropped ? 1 : 0; }
  if ('note' in patch) { sets.push('note = @note'); params.note = patch.note ?? ''; }
  if ('effort' in patch) { sets.push('effort = @effort'); params.effort = patch.effort ?? null; }
  if ('schedule' in patch) { sets.push('schedule = @schedule'); params.schedule = patch.schedule ?? ''; }
  if ('guideUrl' in patch) { sets.push('guide_url = @guideUrl'); params.guideUrl = patch.guideUrl ?? ''; }
  if ('backlogOrder' in patch) { sets.push('backlog_order = @backlogOrder'); params.backlogOrder = patch.backlogOrder ?? null; }
  if ('collectionId' in patch) { sets.push('collection_id = @collectionId'); params.collectionId = patch.collectionId ?? null; }
  if (sets.length > 0) db.prepare(`update planning set ${sets.join(', ')} where user_id = @userId and game_id = @gameId`).run(params);
  return readPlanning(userId);
}

// ─── Coleções (franquias manuais, por usuário) ─────────────────────────────

export function createCollection(userId: number, name: string, gameIds: string[] = []) {
  const tx = db.transaction(() => {
    const inserted = db.prepare('insert into collections (user_id, name) values (?, ?)').run(userId, name.trim());
    const collectionId = Number(inserted.lastInsertRowid);
    const assign = db.prepare('insert or ignore into planning (user_id, game_id) values (?, ?)');
    const update = db.prepare('update planning set collection_id = ? where user_id = ? and game_id = ?');
    for (const id of gameIds) {
      assign.run(userId, Number(id));
      update.run(collectionId, userId, Number(id));
    }
  });
  tx();
  return readPlanning(userId);
}

export function renameCollection(userId: number, collectionId: number, name: string) {
  db.prepare('update collections set name = ? where id = ? and user_id = ?').run(name.trim(), collectionId, userId);
  return readPlanning(userId);
}

export function deleteCollection(userId: number, collectionId: number) {
  const tx = db.transaction(() => {
    db.prepare('update planning set collection_id = null where user_id = ? and collection_id = ?').run(userId, collectionId);
    db.prepare('delete from collections where id = ? and user_id = ?').run(collectionId, userId);
  });
  tx();
  return readPlanning(userId);
}

export function reorderBacklog(userId: number, ids: string[]) {
  const tx = db.transaction(() => {
    ids.forEach((id, index) => patchPlanning(userId, Number(id), { inBacklog: true, backlogOrder: index }));
  });
  tx();
  return readPlanning(userId);
}

export function resetPlanning(userId: number, scope: 'all' | 'notes' | 'backlog') {
  if (scope === 'all') {
    db.prepare('delete from planning where user_id = ?').run(userId);
    db.prepare('delete from collections where user_id = ?').run(userId);
  }
  else if (scope === 'notes') db.prepare("update planning set note = '' where user_id = ?").run(userId);
  else if (scope === 'backlog') db.prepare('update planning set in_backlog = 0, backlog_order = null where user_id = ?').run(userId);
}

export function importPlanning(userId: number, record: Partial<PlanningRecord>) {
  const tx = db.transaction(() => {
    db.prepare('delete from planning where user_id = ?').run(userId);
    db.prepare('delete from collections where user_id = ?').run(userId);
    const collectionIdMap = new Map<number, number>();
    for (const collection of record.collections ?? []) {
      const inserted = db.prepare('insert into collections (user_id, name) values (?, ?)').run(userId, collection.name);
      collectionIdMap.set(collection.id, Number(inserted.lastInsertRowid));
    }
    Object.entries(record.collectionOf ?? {}).forEach(([id, oldCollectionId]) => {
      const collectionId = collectionIdMap.get(Number(oldCollectionId));
      if (collectionId) patchPlanning(userId, Number(id), { collectionId });
    });
    (record.backlog ?? []).forEach((id, index) => patchPlanning(userId, Number(id), { inBacklog: true, backlogOrder: index }));
    (record.pinned ?? []).forEach((id) => patchPlanning(userId, Number(id), { pinned: true }));
    (record.dropped ?? []).forEach((id) => patchPlanning(userId, Number(id), { dropped: true }));
    Object.entries(record.notes ?? {}).forEach(([id, note]) => patchPlanning(userId, Number(id), { note }));
    Object.entries(record.effort ?? {}).forEach(([id, effort]) => patchPlanning(userId, Number(id), { effort }));
    Object.entries(record.schedule ?? {}).forEach(([id, schedule]) => patchPlanning(userId, Number(id), { schedule }));
    Object.entries(record.guides ?? {}).forEach(([id, guideUrl]) => patchPlanning(userId, Number(id), { guideUrl }));
  });
  tx();
  return readPlanning(userId);
}

// ─── Sync runs (por usuário) ────────────────────────────────────────────────

export function listSyncRuns(userId: number, limit = 12) {
  return (db.prepare('select id, platform, started_at, finished_at, status, message from sync_runs where user_id = ? order by id desc limit ?')
    .all(userId, limit) as any[])
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
export function latestSyncByPlatform(userId: number) {
  const rows = db.prepare(`
    select platform, max(started_at) as started_at, status, finished_at
    from sync_runs where user_id = ? group by platform
  `).all(userId) as any[];
  const map: Record<string, { startedAt: string; status: string; finishedAt: string | null }> = {};
  for (const row of rows) map[row.platform] = { startedAt: row.started_at, status: row.status, finishedAt: row.finished_at };
  return map;
}

export function createSyncRun(userId: number, platform: Platform) {
  const run = db.prepare('insert into sync_runs (user_id, platform, started_at, status) values (?, ?, ?, ?)')
    .run(userId, platform, now(), 'running');
  return Number(run.lastInsertRowid);
}

export function finishSyncRun(id: number, status: 'success' | 'error', message?: string) {
  db.prepare('update sync_runs set finished_at = ?, status = ?, message = ? where id = ?')
    .run(now(), status, message ?? '', id);
}
