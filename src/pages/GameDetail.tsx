import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft, Pin, BookmarkPlus, BookmarkCheck, Clock, Trophy } from 'lucide-react';
import { useSteamGames, useGameDetails } from '../hooks/useSteamApi';
import { useLocalDb } from '../hooks/useLocalDb';
import { AchievementList } from '../components/AchievementList';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { SkeletonRow } from '../components/SkeletonCard';
import { gameCoverUrl } from '../lib/steamApi';
import type { EffortLevel } from '../types/steam';

const EFFORT_OPTIONS: { key: EffortLevel; label: string; color: string }[] = [
  { key: 'easy', label: 'Easy', color: 'text-emerald-400 border-emerald-700 bg-emerald-900/20' },
  { key: 'medium', label: 'Medium', color: 'text-amber-400 border-amber-700 bg-amber-900/20' },
  { key: 'hard', label: 'Hard', color: 'text-orange-400 border-orange-700 bg-orange-900/20' },
  { key: 'grind', label: 'Grind', color: 'text-red-400 border-red-700 bg-red-900/20' },
];

function fmt(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.round(minutes / 60);
  return `${h}h`;
}

export default function GameDetail() {
  const { appid } = useParams<{ appid: string }>();
  const navigate = useNavigate();
  const numId = appid ? Number(appid) : null;

  const { games } = useSteamGames();
  const game = useMemo(() => games.find((g) => g.appid === numId), [games, numId]);

  const { data, loading, error } = useGameDetails(numId);
  const { db, toggleBacklog, togglePinned, setNote, setEffort, setSchedule } = useLocalDb();

  const appStr = String(numId);
  const inBacklog = db.backlog.includes(appStr);
  const isPinned = db.pinned.includes(appStr);
  const note = db.notes[appStr] ?? '';
  const effort = db.effort[appStr];
  const schedule = db.schedule[appStr] ?? '';

  const [noteText, setNoteText] = useState(note);

  function saveNote() {
    setNote(appStr, noteText);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-200 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Hero */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        <img
          src={numId ? gameCoverUrl(numId) : ''}
          alt={game?.name}
          className="w-full h-48 object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-xl font-bold text-gray-100">{game?.name ?? `App ${appid}`}</h1>
          {game && (
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — achievements */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress */}
          {data && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-gray-200">Achievements</span>
                </div>
                <span className={`text-lg font-bold font-mono ${completionTextColor(data.completionPercent)}`}>
                  {data.completionPercent}%
                </span>
              </div>
              <ProgressBar percent={data.completionPercent} height="h-2" />
              <p className="text-xs text-gray-600 mt-1.5">
                {data.unlocked} / {data.total} unlocked
              </p>
            </div>
          )}

          {/* Achievement list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Achievement List</h2>
            {error && (
              <p className="text-red-400 text-sm py-4">{error}</p>
            )}
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
          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Actions</h2>
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
          </div>

          {/* Effort */}
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

          {/* Schedule */}
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

          {/* Notes */}
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
