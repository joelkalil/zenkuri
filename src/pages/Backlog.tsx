import { useMemo } from 'react';
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
import { GripVertical, X, Calendar } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { BacklogTimeline } from '../components/BacklogTimeline';
import { GameCover } from '../components/GameCover';
import type { Game } from '../types/steam';

interface SortableItemProps {
  game: Game;
  index: number;
  completion?: { percent: number; unlocked: number; total: number };
  onRemove: () => void;
}

function SortableItem({ game, index, completion, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(game.appid),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors"
    >
      <span className="text-xl font-bold font-mono text-gray-400 w-6 text-center shrink-0">{index + 1}</span>
      <button
        {...attributes}
        {...listeners}
        className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <GameCover game={game} className="w-14 h-10 rounded shrink-0" imgClassName="object-cover" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-200 truncate">{game.name}</p>
        {completion ? (
          <div className="flex items-center gap-2 mt-1">
            <ProgressBar percent={completion.percent} className="flex-1" height="h-1" />
            <span className={`text-xs font-mono font-bold shrink-0 ${completionTextColor(completion.percent)}`}>
              {completion.percent}%
            </span>
          </div>
        ) : (
          <div className="h-1 bg-gray-800 rounded-full mt-1" />
        )}
      </div>
      <button
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 shrink-0 transition-colors"
        title="Remove from backlog"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Backlog() {
  const { games, completionMap } = useSteam();
  const { db, toggleBacklog, reorderBacklog } = useLocalDb();

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Backlog & Schedule</h1>
        <p className="text-gray-500 text-sm mt-1">
          {backlogGames.length} games queued · {scheduledCount} scheduled
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold text-gray-100">Monthly Plan</h2>
        </div>
        <BacklogTimeline games={backlogGames} schedule={db.schedule} />
      </section>

      <section>
        <h2 className="text-base font-bold text-gray-100 mb-4">Priority Order</h2>
        {backlogGames.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/40 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-sm">
              No games in your backlog yet.
              <br />
              Add games from the Library or Game Detail page.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={db.backlog} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
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
