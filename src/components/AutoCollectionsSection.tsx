import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { LibraryCard } from './LibraryCard';
import { SectionHead } from './SectionHead';
import type { AutoCollection, AutoCollectionRole, Game } from '../types/steam';

type Completion = { percent: number; unlocked: number; total: number };

interface AutoCollectionsSectionProps {
  /** "02", "03": número da seção */
  number: string;
  title: string;
  kind: AutoCollection['kind'];
  collections: AutoCollection[];
  games: Game[];
  completionMap: Map<number, Completion>;
  loading: boolean;
  error: string | null;
}

const ROLE_LABEL: Record<AutoCollectionRole, string> = { dev: 'dev', pub: 'pub', both: 'dev·pub' };
const ROLE_TITLE: Record<AutoCollectionRole, string> = { dev: 'Desenvolvedora', pub: 'Publicadora', both: 'Desenvolvedora e publicadora' };

interface VisibleCollection {
  collection: AutoCollection;
  games: Game[];
  /** jogos distintos entre os filtros atuais (Steam + PSN do mesmo jogo contam uma vez) */
  groupCount: number;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Lista compacta + detalhe de coleções automáticas (somente leitura). */
export function AutoCollectionsSection({ number, title, kind, collections, games, completionMap, loading, error }: AutoCollectionsSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo<VisibleCollection[]>(() => {
    const byId = new Map(games.map((game) => [game.appid, game]));
    const result: VisibleCollection[] = [];
    for (const collection of collections) {
      const members = collection.members
        .map((member) => byId.get(member.gameId))
        .filter((game): game is Game => game !== undefined);
      if (members.length === 0) continue;
      const groups = new Set(members.map((game) => game.groupId ?? `game:${game.appid}`));
      result.push({ collection, games: members.sort((a, b) => a.name.localeCompare(b.name)), groupCount: groups.size });
    }
    return result;
  }, [collections, games]);

  const selected = visible.find((item) => item.collection.id === selectedId);

  if (selected) {
    const roles = new Map(selected.collection.members.map((member) => [member.gameId, member.role]));
    return (
      <section>
        <header className="mb-6 border-b border-gray-800 pb-4">
          <button onClick={() => setSelectedId(null)} className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-200">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para {title.toLowerCase()}
          </button>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-2xl font-bold text-gray-100">{selected.collection.name}</h2>
            <span className="text-sm text-gray-500"><span className="num">{selected.groupCount}</span> {plural(selected.groupCount, 'jogo', 'jogos')}</span>
          </div>
        </header>
        <div className="library-grid">
          {selected.games.map((game) => {
            const role = kind === 'company' ? roles.get(game.appid) : undefined;
            return (
              <div key={game.appid}>
                <LibraryCard game={game} completion={completionMap.get(game.appid)} />
                {role && <span className="badge mt-1.5" data-tone="accent" title={ROLE_TITLE[role]}>{ROLE_LABEL[role]}</span>}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const totalGames = visible.reduce((sum, item) => sum + item.groupCount, 0);

  return (
    <section>
      <SectionHead
        number={number}
        title={title}
        sub={visible.length > 0 ? <><span className="num">{visible.length}</span> {plural(visible.length, 'coleção', 'coleções')} · <span className="num">{totalGames}</span> {plural(totalGames, 'jogo', 'jogos')}</> : undefined}
      />
      {error && <p role="alert" className="py-4 text-sm text-zk-danger">{error}</p>}
      {loading && visible.length === 0 && !error && <p className="py-8 text-sm text-gray-500">Carregando coleções…</p>}
      {!loading && !error && visible.length === 0 && (
        <div className="py-8">
          <p className="font-display text-lg font-bold text-gray-100">Nenhuma coleção encontrada.</p>
          <p className="mt-1 text-sm text-gray-500">
            {collections.length === 0
              ? 'Uma coleção aparece quando pelo menos 2 jogos da biblioteca compartilham a mesma franquia ou empresa. Sincronize a Steam para buscar os metadados.'
              : 'Nenhuma coleção tem jogos dentro dos filtros atuais.'}
          </p>
        </div>
      )}
      {visible.length > 0 && (
        <div>
          <div className="col-head flex items-center gap-4 border-b border-gray-800 py-1.5" aria-hidden="true">
            <span className="min-w-0 flex-1">Nome</span>
            <span className="w-16 text-right">Jogos</span>
            <span className="w-4" />
          </div>
          <ul aria-label={title} className="m-0 list-none p-0">
            {visible.map(({ collection, groupCount }) => (
              <li key={collection.id}>
                <button type="button" onClick={() => setSelectedId(collection.id)} className="row w-full text-left">
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-gray-100">{collection.name}</span>
                  <span className="num w-16 text-right font-mono text-[0.8125rem] text-gray-300">{groupCount}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
