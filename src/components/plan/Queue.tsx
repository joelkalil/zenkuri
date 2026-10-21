import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { GripVertical, X } from 'lucide-react';
import { GameCover } from '../GameCover';
import { ProgressBar } from '../ProgressBar';
import { SectionHead } from '../SectionHead';
import { monthKey, monthKeyLabel, monthKeyLong, upcomingMonths } from '../../lib/planDates';
import type { Game } from '../../types/steam';

type Completion = { percent: number; unlocked: number; total: number };

interface QueueProps {
  games: Game[];
  order: string[];
  schedule: Record<string, string>;
  completionMap: Map<number, Completion>;
  today: Date;
  onReorder: (order: string[]) => void;
  onRemove: (id: string) => void;
  onSetMonth: (id: string, month: string) => void;
}

function QueueRow({ game, index, completion, month, months, thisMonth, onRemove, onSetMonth }: {
  game: Game;
  index: number;
  completion?: Completion;
  month: string;
  months: string[];
  thisMonth: string;
  onRemove: () => void;
  onSetMonth: (month: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(game.appid) });
  const percent = completion?.percent ?? 0;
  const late = month !== '' && month < thisMonth && percent < 100;
  const options = month && !months.includes(month) ? [month, ...months] : months;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative grid grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-gray-800 px-1 py-3 ${isDragging ? 'z-10 rounded bg-gray-850 shadow-[var(--popover-shadow)]' : ''}`}
    >
      <span className="num text-right text-sm text-gray-500">{index + 1}</span>
      <Link to={`/game/${game.appid}`} tabIndex={-1} aria-hidden="true">
        <GameCover game={game} className="h-8 w-14 rounded-sm bg-gray-800" imgClassName="object-cover" />
      </Link>
      <div className="min-w-0">
        <Link to={`/game/${game.appid}`} className="block truncate text-sm font-medium text-gray-100 hover:text-violet-400">
          {game.name}
        </Link>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="block min-w-6 flex-1"><ProgressBar percent={percent} height="h-1" /></span>
          <span className={`num w-9 shrink-0 text-right text-xs ${percent === 100 ? 'text-zk-complete' : 'text-gray-500'}`}>{percent}%</span>
          <select
            value={month}
            onChange={(event) => onSetMonth(event.target.value)}
            aria-label={`Mês para fechar ${game.name}`}
            className={`h-7 w-[5.5rem] shrink-0 rounded border bg-transparent px-1.5 text-xs transition-colors hover:border-gray-500 focus:border-violet-400 focus:outline-none ${
              month === thisMonth ? 'border-violet-400 text-violet-400' : late ? 'border-zk-gold text-zk-gold' : 'border-gray-600 text-gray-400'
            }`}
          >
            <option value="">Sem mês</option>
            {options.map((key) => <option key={key} value={key}>{monthKeyLabel(key)}</option>)}
          </select>
          {late && <span className="sr-only">Atrasado: era para {monthKeyLong(month)}.</span>}
        </div>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${game.name} na fila`}
          className="grid h-9 w-8 cursor-grab touch-none place-items-center rounded text-gray-500 hover:bg-gray-850 hover:text-gray-200 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tirar ${game.name} da fila`}
          title="Tirar da fila"
          className="grid h-9 w-8 place-items-center rounded text-gray-500 transition-colors hover:bg-gray-850 hover:text-zk-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * A fila pessoal (o antigo Backlog): ordem de prioridade arrastável e o mês
 * em que cada jogo deve fechar. Vive ao lado do plano, não numa página à parte.
 */
export function Queue({ games, order, schedule, completionMap, today, onReorder, onRemove, onSetMonth }: QueueProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const thisMonth = monthKey(today);
  const months = useMemo(() => upcomingMonths(today, 15), [today]);

  const average = useMemo(() => {
    const values = games.map((game) => completionMap.get(game.appid)?.percent).filter((value): value is number => value !== undefined);
    if (values.length === 0) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [games, completionMap]);

  const thisMonthCount = games.filter((game) => (schedule[String(game.appid)] ?? '').slice(0, 7) === thisMonth).length;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <section aria-label="Minha fila">
      <SectionHead className="sh-wrap" number="03" title="Minha fila" action={<Link to="/library" className="btn btn-secondary btn-sm">Adicionar jogo</Link>} />
      <p className="lede">
        {games.length === 0
          ? 'Ordem de prioridade e mês para fechar cada jogo.'
          : <>
              <span className="num text-gray-100">{games.length}</span> {games.length === 1 ? 'jogo' : 'jogos'}
              {average !== null && <>, média de <span className="num text-gray-100">{average.toLocaleString('pt-BR')}%</span></>}
              {thisMonthCount > 0 && <>; {thisMonthCount} para {monthKeyLong(thisMonth).split(' ')[0]}</>}
            </>}
      </p>

      {games.length === 0 ? (
        <p className="mt-3 border-t border-gray-800 py-6 text-sm leading-relaxed text-gray-500">
          A fila está vazia. Use o botão de fila nos jogos do plano ao lado, ou adicione pela
          {' '}<Link to="/library" className="text-violet-400 hover:text-violet-300">Biblioteca</Link>.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className="mt-3 border-t border-gray-800">
              {games.map((game, index) => (
                <QueueRow
                  key={game.appid}
                  game={game}
                  index={index}
                  completion={completionMap.get(game.appid)}
                  month={(schedule[String(game.appid)] ?? '').slice(0, 7)}
                  months={months}
                  thisMonth={thisMonth}
                  onRemove={() => onRemove(String(game.appid))}
                  onSetMonth={(month) => onSetMonth(String(game.appid), month)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
