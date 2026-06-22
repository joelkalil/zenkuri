import { Lock, Trophy } from 'lucide-react';
import type { AchievementWithStatus } from '../types/steam';

interface AchievementListProps {
  achievements: AchievementWithStatus[];
}

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function typeStyle(type?: string) {
  if (type === 'platinum') return 'border-slate-300/40 bg-slate-400/10 text-slate-200';
  if (type === 'gold') return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300';
  if (type === 'silver') return 'border-gray-400/40 bg-gray-400/10 text-gray-300';
  if (type === 'bronze') return 'border-orange-500/40 bg-orange-500/10 text-orange-300';
  if (type) return 'border-violet-500/40 bg-violet-500/10 text-violet-300';
  return '';
}

export function AchievementList({ achievements }: AchievementListProps) {
  if (achievements.length === 0) {
    return (
      <div className="text-center text-gray-600 py-12">
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No achievements found for this game.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {achievements.map((a) => (
        <li
          key={a.name}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            a.achieved
              ? 'bg-gray-900 border-gray-800 hover:border-gray-700'
              : 'bg-gray-950 border-gray-900 opacity-60'
          }`}
        >
          {/* Icon */}
          <div className="relative shrink-0">
            <img
              src={a.achieved ? a.icon : a.icongray}
              alt=""
              className={`w-12 h-12 rounded-lg ${!a.achieved ? 'grayscale' : ''}`}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {!a.achieved && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
                <Lock className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold truncate ${a.achieved ? 'text-gray-100' : 'text-gray-500'}`}>
                {a.displayName || a.name}
              </p>
              {a.achieved && <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
              {a.type && (
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${typeStyle(a.type)}`}>
                  {a.type}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate mt-0.5">
              {a.hidden && !a.achieved ? 'Hidden achievement' : a.description || 'No description'}
            </p>
            {a.achieved && a.unlocktime > 0 && (
              <p className="text-xs text-blue-500/70 mt-0.5">Unlocked {fmtDate(a.unlocktime)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
