import { Lock, Trophy } from 'lucide-react';
import type { AchievementWithStatus } from '../types/steam';

interface AchievementListProps {
  achievements: AchievementWithStatus[];
}

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  platinum: 'Platina',
  gold: 'Ouro',
  silver: 'Prata',
  bronze: 'Bronze',
};

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
      <div className="py-12 text-center text-gray-600">
        <Trophy className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p>Nenhuma conquista encontrada para este jogo.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {achievements.map((a) => (
        <li
          key={a.name}
          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
            a.achieved ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-900 bg-gray-950 opacity-60'
          }`}
        >
          {/* Icon */}
          <div className="relative shrink-0">
            <img
              src={a.achieved ? a.icon : a.icongray}
              alt=""
              className={`h-12 w-12 rounded-lg ${!a.achieved ? 'grayscale' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
            />
            {!a.achieved && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/50">
                <Lock className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${a.achieved ? 'text-gray-100' : 'text-gray-500'}`}>
              {a.displayName || a.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-600">
              {a.hidden && !a.achieved ? 'Conquista oculta' : a.description || 'Sem descrição'}
            </p>
          </div>

          {/* Meta */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {typeof a.points === 'number' && a.points > 0 && (
                <span className="text-xs font-semibold text-amber-300">{a.points} pts</span>
              )}
              {a.type && TYPE_LABEL[a.type] && (
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${typeStyle(a.type)}`}>
                  {TYPE_LABEL[a.type]}
                </span>
              )}
            </div>
            {a.achieved && a.unlocktime > 0 && (
              <span className="text-xs text-emerald-400/80">{fmtDate(a.unlocktime)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
