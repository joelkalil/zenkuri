import { useId, useMemo, useState } from 'react';
import { useSteam } from '../../context/SteamContext';
import { useT } from '../../i18n';
import type { PlanRef } from '../../types/plan';
import type { Game } from '../../types/steam';
import { Field } from './Field';

const MAX_RESULTS = 8;

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface EntryPickerProps {
  selected: PlanRef | null;
  onPick: (game: Game) => void;
}

/** Searches the synced library and returns the chosen game. */
export function EntryPicker({ selected, onPick }: EntryPickerProps) {
  const t = useT('plan');
  const { games, loading } = useSteam();
  const [query, setQuery] = useState('');
  const id = useId();

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (needle === '') return [];
    return games
      .filter((game) => game.platform && game.platformGameId && normalize(game.name).includes(needle))
      .slice(0, MAX_RESULTS);
  }, [games, query]);

  const hint = selected
    ? t('picker.linked', { ref: `${selected.platform}:${selected.id}` })
    : loading && games.length === 0
      ? t('picker.loading')
      : t('picker.choose');

  return (
    <div className="pe-picker">
      <Field label={t('picker.label')} htmlFor={id} hint={hint}>
        <input id={id} className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('picker.placeholder')} autoComplete="off" />
      </Field>
      {results.length > 0 && (
        <ul className="pe-picker-list" aria-label={t('picker.resultsAria')}>
          {results.map((game) => (
            <li key={`${game.platform}:${game.platformGameId}`}>
              <button
                type="button"
                className="pe-picker-option"
                onClick={() => { onPick(game); setQuery(''); }}
              >
                <span className="min-w-0 flex-1 truncate">{game.name}</span>
                <span className="micro">{game.platform}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() !== '' && results.length === 0 && <p className="pe-hint">{t('picker.none')}</p>}
    </div>
  );
}
