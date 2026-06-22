import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  createSyncRun,
  deleteCredential,
  finishSyncRun,
  getCredential,
  getGameById,
  listAchievements,
  listConfiguredPlatforms,
  listGames,
  patchPlanning,
  readPlanning,
  reorderBacklog,
  setCredential,
} from './db';
import type { Platform } from './types';
import { syncPsnAchievementsForGame, syncPsnLibrary } from './providers/psn';
import { syncRetroAchievementsForGame, syncRetroAchievementsLibrary } from './providers/retroachievements';
import { syncSteamAchievementsForGame, syncSteamLibrary } from './providers/steam';

const app = express();
const port = Number(process.env.ZENKURI_API_PORT ?? 4343);
const platforms: Platform[] = ['steam', 'retroachievements', 'psn'];

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function assertPlatform(value: string): Platform {
  if (!platforms.includes(value as Platform)) throw new Error(`Unsupported platform: ${value}`);
  return value as Platform;
}

function publicCredential(platform: Platform) {
  const credential = getCredential(platform);
  if (!credential) return null;
  const data = credential.data;
  if (platform === 'steam') return { platform, steamid: data.steamid ?? '', configured: true, updatedAt: credential.updatedAt };
  if (platform === 'retroachievements') return { platform, username: data.username ?? '', configured: true, updatedAt: credential.updatedAt };
  if (platform === 'psn') return { platform, configured: true, updatedAt: credential.updatedAt };
  return { platform, configured: true, updatedAt: credential.updatedAt };
}

async function syncLibrary(platform: Platform) {
  if (platform === 'steam') return await syncSteamLibrary();
  if (platform === 'retroachievements') return await syncRetroAchievementsLibrary();
  return await syncPsnLibrary();
}

async function syncAchievements(platform: Platform, gameId: number) {
  if (platform === 'steam') return await syncSteamAchievementsForGame(gameId);
  if (platform === 'retroachievements') return await syncRetroAchievementsForGame(gameId);
  return await syncPsnAchievementsForGame(gameId);
}

async function syncPlatform(platform: Platform) {
  const count = await syncLibrary(platform);
  const games = listGames(platform);
  let achievementSets = 0;
  let detailErrors = 0;

  const shouldHydrate = (game: (typeof games)[number]) => {
    if (!game.has_community_visible_stats) return false;
    if (platform === 'steam') return true;
    return game.completion.total === 0;
  };

  for (const game of games.filter(shouldHydrate)) {
    try {
      const synced = await syncAchievements(platform, game.id);
      if (synced > 0) achievementSets += 1;
    } catch {
      detailErrors += 1;
    }
  }

  return { count, achievementSets, detailErrors };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  const configured = listConfiguredPlatforms();
  res.json({
    configured,
    credentials: platforms.map(publicCredential).filter(Boolean),
  });
});

app.post('/api/config/steam', (req, res) => {
  const { key, steamid } = req.body ?? {};
  if (!String(key ?? '').trim()) return res.status(400).json({ error: 'Steam API key is required.' });
  if (!/^\d{17}$/.test(String(steamid ?? '').trim())) return res.status(400).json({ error: 'Steam ID must be a 17-digit number.' });
  setCredential('steam', { key: String(key).trim(), steamid: String(steamid).trim() });
  res.json({ ok: true });
});

app.post('/api/config/retroachievements', (req, res) => {
  const { username, webApiKey } = req.body ?? {};
  if (!String(username ?? '').trim()) return res.status(400).json({ error: 'RetroAchievements username is required.' });
  if (!String(webApiKey ?? '').trim()) return res.status(400).json({ error: 'RetroAchievements Web API key is required.' });
  setCredential('retroachievements', { username: String(username).trim(), webApiKey: String(webApiKey).trim() });
  res.json({ ok: true });
});

app.post('/api/config/psn', (req, res) => {
  const { npsso } = req.body ?? {};
  if (!String(npsso ?? '').trim()) return res.status(400).json({ error: 'PSN NPSSO is required.' });
  setCredential('psn', { npsso: String(npsso).trim() });
  res.json({ ok: true });
});

app.delete('/api/config/:platform', (req, res) => {
  const platform = assertPlatform(req.params.platform);
  deleteCredential(platform);
  res.json({ ok: true });
});

app.get('/api/games', (req, res) => {
  const platform = req.query.platform ? assertPlatform(String(req.query.platform)) : undefined;
  res.json({ games: listGames(platform) });
});

app.get('/api/games/:id/achievements', async (req, res, next) => {
  try {
    const gameId = Number(req.params.id);
    const game = getGameById(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    let achievements = listAchievements(gameId);
    if (achievements.length === 0) {
      await syncAchievements(game.platform, gameId);
      achievements = listAchievements(gameId);
    }
    res.json({ achievements });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sync/:platform', async (req, res, next) => {
  const platform = assertPlatform(req.params.platform);
  const runId = createSyncRun(platform);
  try {
    const result = await syncPlatform(platform);
    finishSyncRun(runId, 'success', `${result.count} games synced, ${result.achievementSets} achievement sets hydrated`);
    res.json({ ok: true, platform, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    finishSyncRun(runId, 'error', message);
    next(error);
  }
});

app.post('/api/sync', async (_req, res, next) => {
  try {
    const configured = listConfiguredPlatforms().map((entry) => entry.platform);
    const results = [];
    for (const platform of configured) {
      const runId = createSyncRun(platform);
      try {
        const result = await syncPlatform(platform);
        finishSyncRun(runId, 'success', `${result.count} games synced, ${result.achievementSets} achievement sets hydrated`);
        results.push({ platform, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        finishSyncRun(runId, 'error', message);
        results.push({ platform, ok: false, error: message });
      }
    }
    res.json({ ok: true, results });
  } catch (error) {
    next(error);
  }
});

app.get('/api/planning', (_req, res) => {
  res.json(readPlanning());
});

app.patch('/api/planning/:gameId', (req, res) => {
  const gameId = Number(req.params.gameId);
  res.json(patchPlanning(gameId, req.body ?? {}));
});

app.post('/api/planning/backlog/reorder', (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order.map(String) : [];
  res.json(reorderBacklog(order));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Zenkuri API listening on http://localhost:${port}`);
});
