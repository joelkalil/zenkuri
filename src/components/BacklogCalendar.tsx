import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GameCover } from './GameCover';
import type { Game } from '../types/steam';

interface BacklogCalendarProps {
  games: Game[];
  schedule: Record<string, string>; // appid -> "YYYY-MM" | "YYYY-MM-DD"
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Normalize a schedule value to a Date (month-only values land on day 1). */
function scheduleDate(value: string): Date | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return new Date(parts[0], parts[1] - 1, parts.length >= 3 && parts[2] ? parts[2] : 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function BacklogCalendar({ games, schedule }: BacklogCalendarProps) {
  const navigate = useNavigate();

  // default to the month holding the earliest scheduled game, else today
  const initial = useMemo(() => {
    const dates = Object.values(schedule).map(scheduleDate).filter(Boolean) as Date[];
    dates.sort((a, b) => a.getTime() - b.getTime());
    const base = dates[0] ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [schedule]);
  const [view, setView] = useState(initial);

  const gameMap = useMemo(() => new Map(games.map((g) => [String(g.appid), g])), [games]);

  // entries: { date, game }
  const entries = useMemo(() => {
    const list: { date: Date; game: Game }[] = [];
    for (const [id, value] of Object.entries(schedule)) {
      const game = gameMap.get(id);
      const date = scheduleDate(value);
      if (game && date) list.push({ date, game });
    }
    return list;
  }, [schedule, gameMap]);

  // build 6×7 grid starting on the Monday of the week containing day 1
  const cells = useMemo(() => {
    const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
    const weekdayMon = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(firstOfMonth);
    start.setDate(1 - weekdayMon);
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [view]);

  const today = new Date();

  function shift(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100">{MONTHS[view.getMonth()]} {view.getFullYear()}</h3>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-lg border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-lg border border-gray-800 px-2.5 text-xs font-semibold text-gray-400 hover:border-gray-700 hover:text-gray-200">
            Hoje
          </button>
          <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-lg border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-gray-600">{w}</div>
        ))}
        {cells.map((day) => {
          const inMonth = day.getMonth() === view.getMonth();
          const dayGames = entries.filter((e) => sameDay(e.date, day));
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-20 rounded-lg border p-1.5 ${
                inMonth ? 'border-gray-800 bg-gray-950/40' : 'border-transparent bg-transparent opacity-40'
              }`}
            >
              <div className={`mb-1 text-right text-[11px] font-semibold ${isToday ? 'text-violet-300' : 'text-gray-600'}`}>
                {isToday ? <span className="rounded-md bg-violet-600/30 px-1.5 py-0.5">{day.getDate()}</span> : day.getDate()}
              </div>
              <div className="space-y-1">
                {dayGames.slice(0, 3).map(({ game }) => (
                  <button
                    key={game.appid}
                    onClick={() => navigate(`/game/${game.appid}`)}
                    className="flex w-full items-center gap-1.5 rounded-md bg-gray-800/70 p-1 text-left transition-colors hover:bg-gray-700"
                    title={game.name}
                  >
                    <GameCover game={game} className="h-5 w-8 shrink-0 rounded-sm bg-gray-700" imgClassName="object-cover" />
                    <span className="truncate text-[10px] font-medium text-gray-300">{game.name}</span>
                  </button>
                ))}
                {dayGames.length > 3 && (
                  <p className="pl-1 text-[10px] text-gray-600">+{dayGames.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
