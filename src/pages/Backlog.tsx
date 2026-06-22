import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, CalendarDays, ListOrdered, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { BacklogCalendar } from '../components/BacklogCalendar';
import { GameCover } from '../components/GameCover';
import { PLATFORM_META } from '../lib/platforms';
import type { Game, Platform } from '../types/steam';

type Completion = { percent: number; unlocked: number; total: number };

function statusPill(c?: Completion) {
  if (c && c.percent === 100) return { label: '100%', cls: 'border-emerald-600/40 bg-emerald-900/30 text-emerald-300' };
  if (c && c.percent > 0) return { label: 'Em progresso', cls: 'border-violet-600/40 bg-violet-900/30 text-violet-300' };
  return { label: 'Não iniciado', cls: 'border-gray-700 bg-gray-800/60 text-gray-400' };
}

interface SortableItemProps {
  game: Game;
  index: number;
  completion?: Completion;
  onRemove: () => void;
}

function SortableItem({ game, index, completion, onRemove }: SortableItemProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(game.appid) });
  const meta = game.platform ? PLATFORM_META[game.platform as Platform] : null;
  const status = statusPill(completion);

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 transition-colors hover:bg-gray-800/40">
      <span className="w-6 shrink-0 text-center font-mono text-lg font-bold text-gray-500">{index + 1}</span>
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none text-gray-600 hover:text-gray-300 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={() => navigate(`/game/${game.appid}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <GameCover game={game} className="h-10 w-16 shrink-0 rounded-md bg-gray-800" imgClassName="object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-100">{game.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            {meta && <span className="flex items-center gap-1"><img src={meta.logo} alt="" className="h-3 w-3 object-contain" />{meta.short}</span>}
          </div>
        </div>
      </button>
      <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline-block ${status.cls}`}>{status.label}</span>
      <div className="hidden w-40 shrink-0 items-center gap-2 lg:flex">
        {completion ? (
          <>
            <ProgressBar percent={completion.percent} className="flex-1" height="h-1.5" />
            <span className={`w-9 text-right font-mono text-xs font-bold ${completionTextColor(completion.percent)}`}>{completion.percent}%</span>
          </>
        ) : (
          <div className="h-1.5 flex-1 rounded-full bg-gray-800" />
        )}
      </div>
      <button onClick={onRemove} title="Remover do backlog" className="shrink-0 text-gray-600 transition-colors hover:text-red-400">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Backlog() {
  const navigate = useNavigate();
  const { games, completionMap } = useSteam();
  const { db, toggleBacklog, reorderBacklog } = useLocalDb();
  const [view, setView] = useState<'month' | 'list'>('month');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const backlogGames = useMemo(
    () => db.backlog.map((id) => games.find((g) => String(g.appid) === id)).filter(Boolean) as Game[],
    [db.backlog, games],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = db.backlog.indexOf(String(active.id));
    const newIndex = db.backlog.indexOf(String(over.id));
    reorderBacklog(arrayMove(db.backlog, oldIndex, newIndex));
  }

  const scheduledCount = Object.keys(db.schedule).filter((id) => db.backlog.includes(id)).length;

  const monthGoal = useMemo(() => {
    const entries = backlogGames.map((g) => completionMap.get(g.appid)?.percent).filter((p): p is number => p !== undefined);
    if (entries.length === 0) return 0;
    return Math.round((entries.reduce((s, p) => s + p, 0) / entries.length) * 10) / 10;
  }, [backlogGames, completionMap]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Backlog &amp; Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Planeje sua jornada de conquistas · {backlogGames.length} na fila · {scheduledCount} agendados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-gray-800 bg-gray-900 p-1">
            <button onClick={() => setView('month')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'month' ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
              <CalendarDays className="h-3.5 w-3.5" /> Mês
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'list' ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
              <ListOrdered className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-violet-700/40 bg-violet-900/15 px-4 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/70">Metas do Mês</p>
              <p className="text-lg font-bold text-violet-200">{monthGoal}%</p>
            </div>
          </div>
        </div>
      </div>

      {view === 'month' && <BacklogCalendar games={backlogGames} schedule={db.schedule} />}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-100">Prioridade de Backlog</h2>
            <p className="text-xs text-gray-600">Arraste para reordenar sua lista de prioridade</p>
          </div>
          <button onClick={() => navigate('/library')}
            className="flex items-center gap-1.5 rounded-lg border border-violet-600/50 bg-violet-600/15 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-600/25">
            <Plus className="h-3.5 w-3.5" /> Adicionar jogo
          </button>
        </div>

        {backlogGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 py-16 text-center">
            <p className="text-sm text-gray-600">
              Nenhum jogo no backlog ainda.
              <br />
              Adicione jogos pela Library ou pela página do jogo.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={db.backlog} strategy={verticalListSortingStrategy}>
              <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 divide-y divide-gray-800/70">
                {backlogGames.map((game, i) => (
                  <SortableItem
                    key={game.appid}
                    game={game}
                    index={i}
                    completion={completionMap.get(game.appid)}
                    onRemove={() => toggleBacklog(String(game.appid))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}
