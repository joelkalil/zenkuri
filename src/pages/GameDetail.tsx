import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft, CircleSlash, Pin, BookmarkPlus, BookmarkCheck, Clock, Trophy, Link as LinkIcon } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { AchievementList } from '../components/AchievementList';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { SkeletonRow } from '../components/SkeletonCard';
import { GameCover } from '../components/GameCover';
import { PLATFORM_META, psnTrophyBreakdown, type ViewMode } from '../lib/platforms';
import type { EffortLevel, Game } from '../types/steam';

const EFFORT_OPTIONS: { key: EffortLevel; label: string; color: string }[] = [
  { key: 'easy', label: 'Easy', color: 'text-emerald-400 border-emerald-700 bg-emerald-900/20' },
  { key: 'medium', label: 'Medium', color: 'text-amber-400 border-amber-700 bg-amber-900/20' },
  { key: 'hard', label: 'Hard', color: 'text-orange-400 border-orange-700 bg-orange-900/20' },
  { key: 'grind', label: 'Grind', color: 'text-red-400 border-red-700 bg-red-900/20' },
];

function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function platformLabel(platform?: string) {
  if (platform === 'retroachievements') return 'RetroAchievements';
  if (platform === 'psn') return 'PSN';
  return 'Steam';
}

function PlatformGamePanel({ game, achievements }: { game: Game; achievements: { achieved: boolean; points?: number; type?: string }[] }) {
  if (game.platform === 'psn') {
    const breakdown = psnTrophyBreakdown(game);
    const rows = breakdown
      ? [
          ['Platinum', breakdown.platinum.earned, breakdown.platinum.total, 'text-slate-200'],
          ['Gold', breakdown.gold.earned, breakdown.gold.total, 'text-yellow-400'],
          ['Silver', breakdown.silver.earned, breakdown.silver.total, 'text-gray-300'],
          ['Bronze', breakdown.bronze.earned, breakdown.bronze.total, 'text-orange-400'],
        ] as const
      : [];
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">PSN Trophy View</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.map(([label, earned, total, color]) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
              <p className={`text-lg font-bold ${color}`}>{earned}/{total}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (game.platform === 'retroachievements') {
    const points = achievements.reduce((sum, achievement) => sum + (achievement.achieved ? Number(achievement.points ?? 0) : 0), 0);
    const totalPoints = achievements.reduce((sum, achievement) => sum + Number(achievement.points ?? 0), 0);
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">RetroAchievements View</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-amber-300">{points}/{totalPoints}</p><p className="text-xs text-gray-500">Points</p></div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-emerald-400">{game.completion?.percent ?? 0}%</p><p className="text-xs text-gray-500">Hardcore progress</p></div>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-gray-200">{achievements.length}</p><p className="text-xs text-gray-500">Achievements</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Steam Achievement View</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-emerald-400">{game.completion?.percent === 100 ? 'Perfect' : `${game.completion?.percent ?? 0}%`}</p><p className="text-xs text-gray-500">Completion</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-sky-400">{game.completion?.unlocked ?? 0}/{game.completion?.total ?? 0}</p><p className="text-xs text-gray-500">Achievements</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3"><p className="text-lg font-bold text-violet-400">{fmt(game.playtime_forever)}</p><p className="text-xs text-gray-500">Playtime</p></div>
      </div>
    </div>
  );
}

export default function GameDetail() {
  const { appid } = useParams<{ appid: string }>();
  const navigate = useNavigate();
  const numId = appid ? Number(appid) : null;

  const { games, completionMap } = useSteam();
  const game = useMemo(() => games.find((g) => g.appid === numId), [games, numId]);
  const siblingGames = useMemo(
    () => game ? games.filter((item) => item.groupId === game.groupId && item.appid !== game.appid) : [],
    [games, game],
  );

  const { data, loading, error } = useGameDetails(numId);
  const { db, toggleBacklog, togglePinned, toggleDropped, setNote, setGuide, setEffort, setSchedule } = useLocalDb();

  const appStr = String(numId);
  const inBacklog = db.backlog.includes(appStr);
  const isPinned = db.pinned.includes(appStr);
  const isDropped = db.dropped.includes(appStr);
  const effort = db.effort[appStr];
  const schedule = db.schedule[appStr] ?? '';
  const guide = db.guides[appStr] ?? '';

  // Use detail data if loaded, fall back to scanned completion from context
  const contextCompletion = completionMap.get(numId ?? 0);
  const displayPercent = data?.completionPercent ?? contextCompletion?.percent;
  const displayUnlocked = data?.unlocked ?? contextCompletion?.unlocked;
  const displayTotal = data?.total ?? contextCompletion?.total;

  const [noteText, setNoteText] = useState(db.notes[appStr] ?? '');
  const [guideText, setGuideText] = useState(guide);
  const [viewMode, setViewMode] = useState<ViewMode>('common');

  function saveNote() {
    setNote(appStr, noteText);
  }

  function saveGuide() {
    setGuide(appStr, guideText);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-200 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Hero */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        {game && (
          <GameCover
            game={game}
            className="w-full h-48 opacity-60"
            imgClassName="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-xl font-bold text-gray-100">{game?.name ?? `App ${appid}`}</h1>
          {game && (
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="text-gray-400">{platformLabel(game.platform)}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {fmt(game.playtime_forever)} total
              </span>
              {game.playtime_2weeks && (
                <span className="text-blue-400">+{fmt(game.playtime_2weeks)} this 2 weeks</span>
              )}
            </div>
          )}
        </div>
      </div>

      {game && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className="flex items-center gap-2 rounded-lg border border-violet-500 bg-violet-600/15 px-3 py-2 text-xs font-semibold text-violet-300"
            >
              {game.platform && <img src={PLATFORM_META[game.platform].logo} alt="" className="h-4 w-4 object-contain" />}
              {platformLabel(game.platform)}
            </button>
            {siblingGames.map((sibling) => (
              <button
                key={sibling.appid}
                onClick={() => navigate(`/game/${sibling.appid}`)}
                className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs font-semibold text-gray-400 hover:border-gray-700 hover:text-gray-200"
              >
                {sibling.platform && <img src={PLATFORM_META[sibling.platform].logo} alt="" className="h-4 w-4 object-contain grayscale opacity-70" />}
                {platformLabel(sibling.platform)}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-800 bg-gray-950 p-1">
            {(['common', 'platform'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  viewMode === mode ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — achievements */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress */}
          {displayPercent !== undefined && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-gray-200">Achievements</span>
                </div>
                <span className={`text-lg font-bold font-mono ${completionTextColor(displayPercent)}`}>
                  {displayPercent}%
                </span>
              </div>
              <ProgressBar percent={displayPercent} height="h-2" />
              <p className="text-xs text-gray-600 mt-1.5">
                {displayUnlocked} / {displayTotal} unlocked
              </p>
            </div>
          )}

          {game && viewMode === 'platform' && (
            <PlatformGamePanel game={game} achievements={data?.merged ?? []} />
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Achievement List</h2>
            {error && <p className="text-red-400 text-sm py-4">{error}</p>}
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : data ? (
              <AchievementList achievements={data.merged} />
            ) : (
              <p className="text-gray-600 text-sm py-4">Loading achievements…</p>
            )}
          </div>
        </div>

        {/* Right — controls */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Actions</h2>
            {game?.relatedPlatforms && game.relatedPlatforms.length > 0 && (
              <div className="rounded-lg border border-blue-800/30 bg-blue-950/20 px-3 py-2 text-xs text-blue-200">
                Also tracked on {game.relatedPlatforms.map(platformLabel).join(', ')}. Each platform keeps its own completion target.
              </div>
            )}
            <button
              onClick={() => toggleBacklog(appStr)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                inBacklog
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-700/30 hover:bg-blue-600/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {inBacklog ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
              {inBacklog ? 'In backlog' : 'Add to backlog'}
            </button>
            <button
              onClick={() => togglePinned(appStr)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isPinned
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-700/30 hover:bg-violet-600/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <Pin className="w-4 h-4" />
              {isPinned ? 'Pinned as priority' : 'Pin as priority'}
            </button>
            <button
              onClick={() => toggleDropped(appStr)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isDropped
                  ? 'bg-red-600/20 text-red-300 border border-red-700/30 hover:bg-red-600/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <CircleSlash className="w-4 h-4" />
              {isDropped ? 'Marked as dropped' : 'Mark as dropped'}
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Effort Tag</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setEffort(appStr, opt.key)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    effort === opt.key
                      ? opt.color
                      : 'text-gray-600 border-gray-800 bg-gray-950 hover:border-gray-700 hover:text-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {inBacklog && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Target Month</h2>
              <input
                type="month"
                value={schedule}
                onChange={(e) => setSchedule(appStr, e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600 transition-colors"
              />
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Guide Link</h2>
            <div className="flex gap-2">
              <input
                type="url"
                value={guideText}
                onChange={(e) => setGuideText(e.target.value)}
                onBlur={saveGuide}
                placeholder="https://..."
                className="min-w-0 flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
              />
              {guideText && (
                <a
                  href={guideText}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                  title="Open guide"
                >
                  <LinkIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Personal Notes</h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={saveNote}
              placeholder="Tips, strategies, known issues…"
              rows={4}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-600 transition-colors"
            />
            <button
              onClick={saveNote}
              className="mt-2 w-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 py-1.5 rounded-lg transition-colors"
            >
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
