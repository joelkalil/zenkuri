import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  createCollection,
  createSyncRun,
  deleteCollection,
  deleteCredential,
  finishSyncRun,
  getCredential,
  getGameById,
  importPlanning,
  latestSyncByPlatform,
  listAchievements,
  listConfiguredPlatforms,
  listCompletionHistory,
  listGames,
  listRarestUnlocked,
  listSyncRuns,
  listUnlockYears,
  listUnlocks,
  patchPlanning,
  readPlanning,
  renameCollection,
  reorderBacklog,
  resetPlanning,
  updateUserProfile,
  userOwnsGame,
} from './db';
import {
  changePassword,
  extractToken,
  loginUser,
  logoutToken,
  registerUser,
  requireAuth,
  toPublicUser,
} from './auth';
import { linkPlatform, verifyPlatformLink, type PlatformLinkData } from './verification';
import type { ApiGame, Platform } from './types';
import { syncPsnAchievementsForGame, syncPsnLibrary } from './providers/psn';
import { syncRetroAchievementsForGame, syncRetroAchievementsLibrary } from './providers/retroachievements';
import { syncSteamAchievementsForGame, syncSteamLibrary } from './providers/steam';
import { clearMediaCache, serveMedia, warmAchievementMedia, warmGameMedia } from './media';
import { getUserLevel, invalidateUserLevel } from './level';
import { getPlatformLevels, invalidatePlatformLevels } from './platformLevels';

const app = express();
const port = Number(process.env.ZENKURI_API_PORT ?? 4343);
const platforms: Platform[] = ['steam', 'retroachievements', 'psn'];

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function assertPlatform(value: string): Platform {
  if (!platforms.includes(value as Platform)) throw new Error(`Unsupported platform: ${value}`);
  return value as Platform;
}

function linkIdentifier(platform: Platform, data: PlatformLinkData): string {
  if (platform === 'steam') return String(data.steamid ?? '');
  if (platform === 'psn') return String(data.onlineId ?? '');
  return String(data.username ?? '');
}

function publicCredential(userId: number, platform: Platform) {
  const credential = getCredential(userId, platform);
  if (!credential) return null;
  const data = credential.data as PlatformLinkData;
  return {
    platform,
    identifier: linkIdentifier(platform, data),
    verified: Boolean(data.verified),
    configured: Boolean(data.verified),
    // O código só é exposto enquanto o vínculo está pendente de verificação.
    code: data.verified ? undefined : data.code,
    updatedAt: credential.updatedAt,
  };
}

async function syncLibrary(userId: number, platform: Platform) {
  if (platform === 'steam') return await syncSteamLibrary(userId);
  if (platform === 'retroachievements') return await syncRetroAchievementsLibrary(userId);
  return await syncPsnLibrary(userId);
}

async function syncAchievements(userId: number, platform: Platform, gameId: number) {
  if (platform === 'steam') return await syncSteamAchievementsForGame(userId, gameId);
  if (platform === 'retroachievements') return await syncRetroAchievementsForGame(userId, gameId);
  return await syncPsnAchievementsForGame(userId, gameId);
}

function psnTrophyCount(metadata: Record<string, unknown>, key: 'definedTrophies' | 'earnedTrophies') {
  const counts = (metadata[key] ?? {}) as Record<string, unknown>;
  return Number(counts.bronze ?? 0)
    + Number(counts.silver ?? 0)
    + Number(counts.gold ?? 0)
    + Number(counts.platinum ?? 0);
}

function shouldHydrateAchievements(platform: Platform, game: ApiGame) {
  if (!game.has_community_visible_stats) return false;
  if (platform === 'steam') return true;
  if (game.completion.total === 0) return true;

  const metadata = game.metadata ?? {};
  if (platform === 'psn') {
    return game.completion.total !== psnTrophyCount(metadata, 'definedTrophies')
      || game.completion.unlocked !== psnTrophyCount(metadata, 'earnedTrophies');
  }

  const total = Number(metadata.maxPossible ?? 0);
  const unlocked = Number(metadata.numAwardedHardcore ?? metadata.numAwarded ?? 0);
  return (total > 0 && game.completion.total !== total)
    || game.completion.unlocked !== unlocked;
}

async function syncPlatform(userId: number, platform: Platform) {
  try {
    return await runPlatformSync(userId, platform);
  } finally {
    // Conquistas novas mudam o XP. Invalidar no `finally` cobre também o sync
    // que falha no meio: o que já entrou no banco precisa contar.
    invalidateUserLevel(userId);
    invalidatePlatformLevels(userId);
  }
}

async function runPlatformSync(userId: number, platform: Platform) {
  const count = await syncLibrary(userId, platform);
  // Mirror every cover + game icon locally (best effort, never blocks the sync).
  await warmGameMedia(platform).catch(() => 0);
  const games = listGames(userId, platform);
  let achievementSets = 0;
  let detailErrors = 0;
  // Guarda a última mensagem (ex.: key da Steam inválida) pra aparecer no
  // histórico de sync mesmo quando o erro não chega a abortar o sync inteiro
  // (cada jogo falha isolado no try/catch abaixo).
  let lastDetailError: string | undefined;

  for (const game of games.filter((item) => shouldHydrateAchievements(platform, item))) {
    try {
      const synced = await syncAchievements(userId, platform, game.id);
      if (synced > 0) {
        achievementSets += 1;
        await warmAchievementMedia(game.id).catch(() => 0);
      }
    } catch (err) {
      detailErrors += 1;
      lastDetailError = err instanceof Error ? err.message : String(err);
    }
  }

  return { count, achievementSets, detailErrors, lastDetailError };
}

function describeSyncResult(result: { count: number; achievementSets: number; detailErrors: number; lastDetailError?: string }): string {
  const base = `${result.count} games synced, ${result.achievementSets} achievement sets hydrated`;
  if (result.detailErrors === 0) return base;
  const reason = result.lastDetailError ? ` (${result.lastDetailError})` : '';
  return `${base}, ${result.detailErrors} failed${reason}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Local media cache: serves a mirrored file, lazily downloading from the
// original source on first hit, and falling back to a branded placeholder.
// O catálogo de artes é compartilhado entre usuários, então fica público.
app.use('/media', async (req, res, next) => {
  try {
    const parts = req.path.replace(/^\/+/, '').split('/').filter(Boolean);
    const resolved = await serveMedia(parts);
    if (!resolved) return res.status(404).end();
    const isPlaceholder = resolved.filePath.toLowerCase().endsWith('.svg');
    res.setHeader('Content-Type', resolved.contentType);
    // Cached art is immutable; placeholders should be revalidated so a manual
    // drop-in replacement shows up without a hard refresh.
    res.setHeader('Cache-Control', isPlaceholder ? 'no-cache' : 'public, max-age=86400');
    res.end(resolved.body);
  } catch (error) {
    next(error);
  }
});

// ─── Autenticação ───────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, displayName } = req.body ?? {};
    const result = registerUser(String(username ?? ''), String(password ?? ''), displayName ? String(displayName) : undefined);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao criar conta.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    res.json(loginUser(String(username ?? ''), String(password ?? '')));
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Falha ao entrar.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  logoutToken(extractToken(req));
  res.json({ ok: true });
});

// Tudo abaixo exige sessão válida.
app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

app.post('/api/auth/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    changePassword(req.user!, String(currentPassword ?? ''), String(newPassword ?? ''));
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao alterar a senha.' });
  }
});

app.patch('/api/auth/profile', (req, res) => {
  const displayName = String(req.body?.displayName ?? '').trim();
  if (!displayName) return res.status(400).json({ error: 'O nome de exibição é obrigatório.' });
  updateUserProfile(req.userId!, displayName);
  res.json({ user: { ...toPublicUser(req.user!), displayName } });
});

// ─── Contas de plataforma ───────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  // "configured" = plataformas prontas para sync (vínculo verificado);
  // "credentials" inclui também vínculos pendentes, com o código de verificação.
  const configured = listConfiguredPlatforms(req.userId!).filter((entry) => entry.verified);
  res.json({
    configured,
    credentials: platforms.map((platform) => publicCredential(req.userId!, platform)).filter(Boolean),
  });
});

// Vincula uma conta de plataforma a partir do identificador público
// (SteamID/URL, online ID da PSN ou username do RA). Nenhuma credencial
// do usuário é pedida — as consultas usam a conta de serviço do .env.
app.post('/api/config/:platform', async (req, res) => {
  try {
    const platform = assertPlatform(req.params.platform);
    const body = req.body ?? {};
    const identifier = String(body.identifier ?? body.steamid ?? body.onlineId ?? body.username ?? '');
    await linkPlatform(req.userId!, platform, identifier);
    res.json({ ok: true, credential: publicCredential(req.userId!, platform) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao vincular a conta.' });
  }
});

// Confere se o código de verificação está na descrição do perfil.
app.post('/api/config/:platform/verify', async (req, res) => {
  try {
    const platform = assertPlatform(req.params.platform);
    await verifyPlatformLink(req.userId!, platform);
    res.json({ ok: true, credential: publicCredential(req.userId!, platform) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao verificar o vínculo.' });
  }
});

app.delete('/api/config/:platform', (req, res) => {
  const platform = assertPlatform(req.params.platform);
  deleteCredential(req.userId!, platform);
  res.json({ ok: true });
});

// ─── Jogos e conquistas ─────────────────────────────────────────────────────

app.get('/api/games', (req, res) => {
  const platform = req.query.platform ? assertPlatform(String(req.query.platform)) : undefined;
  res.json({ games: listGames(req.userId!, platform) });
});

app.get('/api/games/:id/achievements', async (req, res, next) => {
  try {
    const gameId = Number(req.params.id);
    const game = getGameById(gameId);
    if (!game || !userOwnsGame(req.userId!, gameId)) return res.status(404).json({ error: 'Game not found.' });
    let achievements = listAchievements(req.userId!, gameId);
    if (achievements.length === 0) {
      await syncAchievements(req.userId!, game.platform, gameId);
      achievements = listAchievements(req.userId!, gameId);
    }
    res.json({ achievements });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sync/:platform', async (req, res, next) => {
  const platform = assertPlatform(req.params.platform);
  const runId = createSyncRun(req.userId!, platform);
  try {
    const result = await syncPlatform(req.userId!, platform);
    finishSyncRun(runId, 'success', describeSyncResult(result));
    // `ok` reflete se o sync ficou 100% limpo — mesmo sem lançar, jogos
    // individuais podem ter falhado (ex.: key inválida no meio da hidratação
    // de conquistas), e a UI precisa saber disso pra avisar o usuário.
    res.json({ ok: result.detailErrors === 0, platform, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    finishSyncRun(runId, 'error', message);
    next(error);
  }
});

app.post('/api/sync', async (req, res, next) => {
  try {
    const configured = listConfiguredPlatforms(req.userId!)
      .filter((entry) => entry.verified)
      .map((entry) => entry.platform);
    const results = [];
    for (const platform of configured) {
      const runId = createSyncRun(req.userId!, platform);
      try {
        const result = await syncPlatform(req.userId!, platform);
        finishSyncRun(runId, 'success', describeSyncResult(result));
        results.push({ platform, ok: result.detailErrors === 0, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        finishSyncRun(runId, 'error', message);
        results.push({ platform, ok: false, error: message });
      }
    }
    res.json({ ok: results.every((r) => r.ok), results });
  } catch (error) {
    next(error);
  }
});

app.get('/api/sync/runs', (req, res) => {
  res.json({ runs: listSyncRuns(req.userId!, 12), latest: latestSyncByPlatform(req.userId!) });
});

app.get('/api/completions/recent', (req, res) => {
  const requested = Number(req.query.limit ?? 8);
  const limit = Number.isFinite(requested) ? Math.min(500, Math.max(1, Math.round(requested))) : 8;
  res.json(listCompletionHistory(req.userId!, limit));
});

// Desbloqueios de um ano (heatmap + almanaque). Sem `year`, usa o ano corrente.
app.get('/api/unlocks', (req, res) => {
  const requested = Number(req.query.year);
  const year = Number.isInteger(requested) && requested > 1970 ? requested : new Date().getUTCFullYear();
  res.json({ year, years: listUnlockYears(req.userId!), unlocks: listUnlocks(req.userId!, year) });
});

// Nível do usuário, derivado das conquistas desbloqueadas.
app.get('/api/level', (req, res) => {
  res.json(getUserLevel(req.userId!));
});

// Nível nativo de cada plataforma (Steam, PSN, RetroAchievements), ao vivo.
app.get('/api/level/platforms', async (req, res, next) => {
  try {
    res.json({ items: await getPlatformLevels(req.userId!, { fresh: req.query.fresh === '1' }) });
  } catch (err) {
    next(err);
  }
});

// Conquistas desbloqueadas mais raras da coleção (vitrine do painel).
app.get('/api/showcase/rarest', (req, res) => {
  const requested = Number(req.query.limit ?? 3);
  const limit = Number.isFinite(requested) ? Math.min(12, Math.max(1, Math.round(requested))) : 3;
  res.json({ items: listRarestUnlocked(req.userId!, limit) });
});

app.post('/api/media/clear', (_req, res) => {
  res.json(clearMediaCache());
});

// ─── Planning ───────────────────────────────────────────────────────────────

app.get('/api/planning', (req, res) => {
  res.json(readPlanning(req.userId!));
});

app.post('/api/planning/reset', (req, res) => {
  const scope = req.body?.scope === 'notes' || req.body?.scope === 'backlog' ? req.body.scope : 'all';
  resetPlanning(req.userId!, scope);
  res.json(readPlanning(req.userId!));
});

app.post('/api/planning/import', (req, res) => {
  res.json(importPlanning(req.userId!, req.body ?? {}));
});

app.patch('/api/planning/:gameId', (req, res) => {
  const gameId = Number(req.params.gameId);
  res.json(patchPlanning(req.userId!, gameId, req.body ?? {}));
});

app.post('/api/planning/backlog/reorder', (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order.map(String) : [];
  res.json(reorderBacklog(req.userId!, order));
});

// ─── Coleções (franquias manuais) ───────────────────────────────────────────

app.post('/api/collections', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'Nome da coleção é obrigatório' });
    return;
  }
  const gameIds = Array.isArray(req.body?.gameIds) ? req.body.gameIds.map(String) : [];
  res.json(createCollection(req.userId!, name, gameIds));
});

app.patch('/api/collections/:id', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'Nome da coleção é obrigatório' });
    return;
  }
  res.json(renameCollection(req.userId!, Number(req.params.id), name));
});

app.delete('/api/collections/:id', (req, res) => {
  res.json(deleteCollection(req.userId!, Number(req.params.id)));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Zenkuri API listening on http://localhost:${port}`);
});
