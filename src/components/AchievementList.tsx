import { Lock, Unlock, Trophy } from 'lucide-react';
import type { AchievementWithStatus, Platform } from '../types/steam';

interface AchievementListProps {
  achievements: AchievementWithStatus[];
  platform?: Platform;
}

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const TYPE_LABEL: Record<string, string> = {
  platinum: 'Platina',
  gold: 'Ouro',
  silver: 'Prata',
  bronze: 'Bronze',
};

const TYPE_ICON: Record<string, string> = {
  platinum: '/trophies/platinum.png',
  gold: '/trophies/gold.png',
  silver: '/trophies/silver.png',
  bronze: '/trophies/bronze.png',
};

const TYPE_COLOR: Record<string, string> = {
  platinum: 'text-slate-200',
  gold: 'text-yellow-300',
  silver: 'text-gray-300',
  bronze: 'text-orange-300',
};

export function AchievementList({ achievements }: AchievementListProps) {
  if (achievements.length === 0) {
    return (
      <div className="py-12 text-center text-gray-600">
        <Trophy className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p>Nenhum troféu encontrado para este filtro.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {achievements.map((a) => {
        const earned = a.achieved;
        const trophyIcon = a.type ? TYPE_ICON[a.type] : undefined;
        return (
          <li
            key={a.name}
            className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
              earned ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-900 bg-gray-950/60'
            }`}
          >
            {/* Badge */}
            <div className="relative shrink-0">
              <img
                src={earned ? a.icon : a.icongray}
                alt=""
                className={`h-12 w-12 rounded-lg ${earned ? '' : 'grayscale opacity-60'}`}
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
              />
            </div>

            {/* Title + description */}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${earned ? 'text-gray-100' : 'text-gray-500'}`}>
                {a.displayName || a.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-600">
                {a.hidden && !earned ? 'Troféu oculto' : a.description || 'Sem descrição'}
              </p>
            </div>

            {/* Type (PSN trophy icon) or points (RA) */}
            {trophyIcon && a.type ? (
              <div className={`hidden w-24 shrink-0 items-center gap-2 sm:flex ${earned ? '' : 'opacity-60'}`}>
                <img src={trophyIcon} alt="" className="h-6 w-6 object-contain" />
                <span className={`text-xs font-semibold ${TYPE_COLOR[a.type] ?? 'text-gray-300'}`}>{TYPE_LABEL[a.type]}</span>
              </div>
            ) : typeof a.points === 'number' && a.points > 0 ? (
              <span className={`hidden w-24 shrink-0 text-xs font-semibold text-amber-300 sm:block ${earned ? '' : 'opacity-60'}`}>
                {a.points} pts
              </span>
            ) : (
              <span className="hidden w-24 shrink-0 sm:block" />
            )}

            {/* Date + time */}
            <div className="hidden w-24 shrink-0 text-right sm:block">
              {earned && a.unlocktime > 0 ? (
                <>
                  <p className="text-xs font-medium text-emerald-400/90 tabular-nums">{fmtDate(a.unlocktime)}</p>
                  <p className="text-[11px] text-gray-600 tabular-nums">{fmtTime(a.unlocktime)}</p>
                </>
              ) : (
                <p className="text-xs text-gray-700">—</p>
              )}
            </div>

            {/* Lock status */}
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                earned ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-900 text-gray-700'
              }`}
              title={earned ? 'Desbloqueado' : 'Bloqueado'}
            >
              {earned ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
