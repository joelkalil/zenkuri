import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { gameCoverUrl } from '../lib/steamApi';
import type { Game } from '../types/steam';

interface BacklogTimelineProps {
  games: Game[];
  schedule: Record<string, string>; // appid -> "YYYY-MM"
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function getMonths(schedule: Record<string, string>): string[] {
  const months = new Set(Object.values(schedule).filter(Boolean));
  return [...months].sort();
}

export function BacklogTimeline({ games, schedule }: BacklogTimelineProps) {
  const navigate = useNavigate();
  const gameMap = new Map(games.map((g) => [String(g.appid), g]));
  const months = getMonths(schedule);
  const unscheduled = games.filter((g) => !schedule[String(g.appid)]);

  if (months.length === 0 && unscheduled.length === 0) {
    return (
      <div className="text-center text-gray-600 py-10">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No backlog entries yet. Add games from the Library or Game Detail page.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max">
        {months.map((month) => {
          const monthGames = Object.entries(schedule)
            .filter(([, m]) => m === month)
            .map(([id]) => gameMap.get(id))
            .filter(Boolean) as Game[];

          return (
            <div key={month} className="w-52 shrink-0">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {fmtMonth(month)}
                <span className="text-gray-600 font-normal">({monthGames.length})</span>
              </div>
              <div className="space-y-2">
                {monthGames.map((g) => (
                  <button
                    key={g.appid}
                    onClick={() => navigate(`/game/${g.appid}`)}
                    className="w-full flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2 hover:border-gray-600 transition-colors text-left"
                  >
                    <img
                      src={gameCoverUrl(g.appid)}
                      alt=""
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <span className="text-xs text-gray-200 font-medium leading-tight line-clamp-2">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Unscheduled column */}
        {unscheduled.length > 0 && (
          <div className="w-52 shrink-0">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">
              Unscheduled ({unscheduled.length})
            </div>
            <div className="space-y-2">
              {unscheduled.map((g) => (
                <button
                  key={g.appid}
                  onClick={() => navigate(`/game/${g.appid}`)}
                  className="w-full flex items-center gap-2 bg-gray-950 border border-gray-900 rounded-lg p-2 hover:border-gray-700 transition-colors text-left"
                >
                  <img
                    src={gameCoverUrl(g.appid)}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0 opacity-60"
                  />
                  <span className="text-xs text-gray-500 font-medium leading-tight line-clamp-2">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
