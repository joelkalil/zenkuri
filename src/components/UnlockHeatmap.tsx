const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const CELL = 12; // px
const GAP = 3; // px

/** Escala de calor quente: papel → âmbar → laranja → vermelho solar. */
function bucketClass(count: number): string {
  if (count === 0) return 'bg-gray-800/50';
  if (count <= 2) return 'bg-amber-400/30';
  if (count <= 5) return 'bg-amber-400/60';
  if (count <= 9) return 'bg-orange-400/80';
  return 'bg-red-500';
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface UnlockHeatmapProps {
  year: number;
  /** contagem de desbloqueios por dia, chave "YYYY-MM-DD" (UTC) */
  counts: Map<string, number>;
}

/** Calendário anual de desbloqueios, uma coluna por semana (domingo no topo). */
export function UnlockHeatmap({ year, counts }: UnlockHeatmapProps) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const days: { key: string; col: number; row: number; month: number; label: string }[] = [];
  let col = 0;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const row = d.getUTCDay();
    days.push({
      key: dayKey(d),
      col,
      row,
      month: d.getUTCMonth(),
      label: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
    });
    if (row === 6) col += 1;
  }
  const totalCols = col + 1;

  const monthOffsets = MONTHS_PT.map((label, month) => ({
    label,
    col: days.find((day) => day.month === month)?.col ?? 0,
  }));

  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ width: totalCols * (CELL + GAP) }}>
        <div className="relative h-4">
          {monthOffsets.map(({ label, col: monthCol }) => (
            <span
              key={label}
              className="absolute top-0 text-[10px] font-medium uppercase tracking-wide text-gray-600"
              style={{ left: monthCol * (CELL + GAP) }}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: 7 * (CELL + GAP) }}>
          {days.map((day) => {
            const count = counts.get(day.key) ?? 0;
            return (
              <span
                key={day.key}
                title={`${day.label}: ${count} ${count === 1 ? 'conquista' : 'conquistas'}`}
                className={`absolute rounded-[3px] ${bucketClass(count)}`}
                style={{
                  width: CELL,
                  height: CELL,
                  left: day.col * (CELL + GAP),
                  top: day.row * (CELL + GAP),
                }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-gray-600">
          Menos
          {[0, 1, 3, 6, 10].map((sample) => (
            <span key={sample} className={`h-3 w-3 rounded-[3px] ${bucketClass(sample)}`} />
          ))}
          Mais
        </div>
      </div>
    </div>
  );
}
