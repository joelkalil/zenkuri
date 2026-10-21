import { useI18n } from '../i18n';
import { monthShortName } from '../i18n/format';
import '../styles/almanaque.css';

const CELL = 15; // px
const GAP = 3; // px

/** Intensity scale (0-4) with the accent: from a hairline to full vermilion. */
function levelOf(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface UnlockHeatmapProps {
  year: number;
  /** unlock count per day, keyed "YYYY-MM-DD" (UTC) */
  counts: Map<string, number>;
}

/** Yearly unlock calendar, one column per week (Sunday on top). */
export function UnlockHeatmap({ year, counts }: UnlockHeatmapProps) {
  const { t, plural, locale, formatDate } = useI18n();
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
      label: formatDate(d.getTime(), { day: 'numeric', month: 'long', timeZone: 'UTC' }),
    });
    if (row === 6) col += 1;
  }
  const totalCols = col + 1;

  const monthOffsets = Array.from({ length: 12 }, (_, month) => ({
    label: monthShortName(locale, month),
    col: days.find((day) => day.month === month)?.col ?? 0,
  }));

  return (
    <div className="hm-heat overflow-x-auto pb-1">
      <div style={{ width: totalCols * (CELL + GAP) }}>
        <div className="relative h-5">
          {monthOffsets.map(({ label, col: monthCol }) => (
            <span key={label} className="hm-month" style={{ left: monthCol * (CELL + GAP) }}>{label}</span>
          ))}
        </div>
        <div className="relative" style={{ height: 7 * (CELL + GAP) }} role="img" aria-label={t('game.heatmap.label', { year })}>
          {days.map((day) => {
            const count = counts.get(day.key) ?? 0;
            return (
              <span
                key={day.key}
                title={plural('game.heatmap.cell', count, { date: day.label })}
                className="hm-cell"
                data-level={levelOf(count)}
                style={{ width: CELL, height: CELL, left: day.col * (CELL + GAP), top: day.row * (CELL + GAP) }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-gray-500">
          {t('game.heatmap.less')}
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="hm-swatch" data-level={level} aria-hidden="true" />
          ))}
          {t('game.heatmap.more')}
        </div>
      </div>
    </div>
  );
}
