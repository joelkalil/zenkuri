import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { RankedGame, RankingList, RankingListId } from '../../server/rankings/types';
import { formatReason } from '../i18n/messages/rankings/formatReason';
import { useI18n, useT } from '../i18n';
import type { ScopedStringKey } from '../i18n/types';
import { RichText } from '../components/RichText';
import { withSlots } from '../i18n/withSlots';
import { Attribution } from '../components/community/Attribution';
import { GameCover } from '../components/GameCover';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { StoreCover } from '../components/StoreCover';
import { useSteam } from '../context/SteamContext';
import { useAutoRankings } from '../hooks/useAutoRankings';
import { contentLang } from '../hooks/useCommunity';
import { useCuratedRanking } from '../hooks/useCuratedRanking';
import { useGameNotes } from '../hooks/useGameNotes';
import { fetchRecentCompletions, type CompletionHistoryItem } from '../lib/api';
import { hasPsnPlatinum, PLATFORM_META } from '../lib/platforms';
import { steamStoreUrl } from '../lib/steamStore';
import type { GameNote } from '../types/plan';
import type { Game, Platform } from '../types/steam';
import '../styles/rankings.css';

const LIST_PARAM = 'lista';
const CURATED_TAB = 'essenciais';
const CURATED_SLUG = 'essenciais';
const AUTO_IDS: readonly RankingListId[] = ['finish', 'quick', 'grind', 'demanding'];

type TabId = RankingListId | typeof CURATED_TAB;

function asTab(value: string | null): TabId {
  if (value === CURATED_TAB) return CURATED_TAB;
  return AUTO_IDS.find((id) => id === value) ?? 'finish';
}

/*
 * The server sends English label, shortLabel and description for each list; the
 * client renders them by stable list id instead.
 */
const LIST_KEYS = {
  finish: { label: 'lists.finish.label', short: 'lists.finish.short', description: 'lists.finish.description' },
  quick: { label: 'lists.quick.label', short: 'lists.quick.short', description: 'lists.quick.description' },
  grind: { label: 'lists.grind.label', short: 'lists.grind.short', description: 'lists.grind.description' },
  demanding: { label: 'lists.demanding.label', short: 'lists.demanding.short', description: 'lists.demanding.description' },
} as const satisfies Record<RankingListId, Record<'label' | 'short' | 'description', ScopedStringKey<'rankings'>>>;

function useEstimateFormat() {
  const t = useT('rankings');
  const { formatNumber } = useI18n();
  return (range: [number, number] | null) => {
    if (!range) return '—';
    const [lo, hi] = range;
    const oneDecimal = { maximumFractionDigits: 1 };
    return lo === hi
      ? t('estimate.single', { hours: formatNumber(lo, oneDecimal) })
      : t('estimate.range', { min: formatNumber(lo, oneDecimal), max: formatNumber(hi, oneDecimal) });
  };
}

function RecentCompletion({ item }: { item: CompletionHistoryItem }) {
  const t = useT('rankings');
  const { formatDate } = useI18n();
  const navigate = useNavigate();
  const platform = item.game.platform as Platform;
  const isPlatinum = item.kind === 'platinum';

  return (
    <button onClick={() => navigate(`/game/${item.game.appid}`)} className="row group w-full px-1 text-left">
      <GameCover game={item.game} portrait className="h-14 w-10 shrink-0 rounded-sm bg-gray-800" imgClassName="object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-200 group-hover:text-violet-400">{item.game.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <img src={PLATFORM_META[platform].logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {PLATFORM_META[platform].short}
          <span aria-hidden="true">·</span>
          <span className="num">{formatDate(item.completedAt * 1000, { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
        </span>
      </span>
      <img
        src={isPlatinum ? '/trophies/platinum.png' : '/trophies/achievement-100.png'}
        alt={isPlatinum ? t('situation.platinum') : t('situation.perfect')}
        className="h-6 w-6 shrink-0 object-contain"
      />
    </button>
  );
}

function RecentSection({ number, title, subtitle, items }: {
  number: string;
  title: string;
  subtitle: string;
  items: CompletionHistoryItem[];
}) {
  const t = useT('rankings');
  return (
    <section>
      <SectionHead className="sh-wrap" number={number} title={title} sub={subtitle} />
      <div>
        {items.length > 0 ? items.slice(0, 5).map((item) => (
          <RecentCompletion key={`${item.kind}-${item.game.appid}`} item={item} />
        )) : (
          <p className="py-4 text-sm text-gray-500">{t('recent.empty')}</p>
        )}
      </div>
    </section>
  );
}

function isDone(game: Game) {
  return game.completion?.percent === 100 || hasPsnPlatinum(game);
}

/** Game status on your account: stamp if completed, % if started, dash if not. */
function Situation({ game }: { game: Game }) {
  const t = useT('rankings');
  const percent = game.completion?.percent ?? 0;
  if (hasPsnPlatinum(game)) {
    return <span className="rk-state" data-tone="platina"><Stamp kind="platina" size={24} seed={game.appid} />{t('situation.platinum')}</span>;
  }
  if (percent >= 100) {
    return <span className="rk-state" data-tone="complete"><Stamp kind="100" size={24} seed={game.appid} />{t('situation.perfect')}</span>;
  }
  if (percent > 0) return <span className="rk-state num">{percent}%</span>;
  return <span className="rk-state text-gray-500">{t('situation.notStarted')}</span>;
}

/** "your note" under the row: personal estimate and the user's annotation. */
function PersonalNote({ note }: { note: GameNote }) {
  const t = useT('rankings');
  if (!note.estimate && !note.note) return null;
  return (
    <p className="rk-mynote">
      <span className="micro">{t('myNote')}</span>
      {note.estimate && <span className="num rk-mynote-est">{note.estimate}</span>}
      {note.note && <span>{note.note}</span>}
    </p>
  );
}

interface RankItemProps {
  rank: number;
  cover: ReactNode;
  title: ReactNode;
  detail: string;
  platform: Platform;
  situation: ReactNode;
  estimate: string;
  muted?: boolean;
  /** language of `detail` when it is authored pack content */
  detailLang?: string;
  /** when present, the whole row is a link */
  to?: string;
  note?: GameNote;
}

function RankItem({ rank, cover, title, detail, detailLang, platform, situation, estimate, muted = false, to, note }: RankItemProps) {
  const meta = PLATFORM_META[platform];
  const body = (
    <>
      <span className="rk-pos">{String(rank).padStart(2, '0')}</span>
      <span className="rk-cover">{cover}</span>
      <span className="min-w-0">
        <span className="rk-name block truncate">{title}</span>
        {detail && <span className="rk-note" lang={detailLang}>{detail}</span>}
        <span className="rk-mobile-meta">
          <img src={meta.logo} alt="" className="h-3.5 w-3.5 object-contain" />
          {meta.short}
          <span className="num">· {estimate}</span>
        </span>
      </span>
      <span className="rk-plat rk-hide-md">
        <img src={meta.logo} alt="" />{meta.short}
      </span>
      {situation}
      <span className="rk-est num text-xs text-gray-300 rk-hide-md">{estimate}</span>
    </>
  );

  return (
    <li className="rk-item" data-muted={muted ? 'true' : undefined}>
      {to ? <Link to={to} className="rk-row">{body}</Link> : <div className="rk-row">{body}</div>}
      {note && <PersonalNote note={note} />}
    </li>
  );
}

function ListHead() {
  const t = useT('rankings');
  return (
    <div className="rk-head col-head" aria-hidden="true">
      <span>{t('columns.rank')}</span><span /><span>{t('columns.game')}</span><span>{t('columns.platform')}</span><span>{t('columns.situation')}</span><span className="text-right">{t('columns.estimate')}</span>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-[72px] rounded-sm bg-gray-850" />)}
    </div>
  );
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  const t = useT('rankings');
  return (
    <div className="empty-state" role="alert">
      <strong>{title}</strong>
      <span className="text-zk-danger">{message}</span>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>{t('error.retry')}</button>
    </div>
  );
}

function NoGamesState() {
  const t = useT('rankings');
  return (
    <div className="empty-state">
      <strong>{t('noGames.title')}</strong>
      <span>{t('noGames.body')}</span>
      <Link to="/settings?tab=connections" className="btn btn-primary">{t('noGames.connect')}</Link>
    </div>
  );
}

interface AutoListProps {
  list: RankingList;
  gamesById: Map<number, Game>;
  notes: Map<number, GameNote>;
}

function AutoList({ list, gamesById, notes }: AutoListProps) {
  const i18n = useI18n();
  const t = useT('rankings');
  const formatEstimate = useEstimateFormat();
  const rows = list.entries.flatMap((entry: RankedGame) => {
    const game = gamesById.get(entry.gameId);
    return game ? [{ entry, game }] : [];
  });

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="ranking-title">
      <SectionHead
        className="sh-wrap"
        number="01"
        title={<span id="ranking-title">{t(LIST_KEYS[list.id].label)}</span>}
        action={rows.length > 0 ? <span className="text-xs text-gray-500"><span className="num text-gray-100">{rows.length}</span> {t.plural('auto.games', rows.length)}</span> : undefined}
      />
      <p className="lede -mt-3 max-w-3xl">{t(LIST_KEYS[list.id].description)}</p>
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>{t('auto.emptyTitle')}</strong>
          <span>{t('auto.emptyBody')}</span>
        </div>
      ) : (
        <>
          <ListHead />
          <ol className="rk-list">
            {rows.map(({ entry, game }, index) => (
              <RankItem
                key={game.appid}
                rank={index + 1}
                cover={<GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" />}
                title={game.name}
                detail={entry.reasons.map((reason) => formatReason(reason, i18n)).join(' · ')}
                platform={game.platform as Platform}
                situation={<Situation game={game} />}
                estimate={formatEstimate(entry.estimateHours)}
                to={`/game/${game.appid}`}
                note={notes.get(game.id)}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

interface CuratedListProps {
  gamesByKey: Map<string, Game>;
  notes: Map<number, GameNote>;
}

function CuratedList({ gamesByKey, notes }: CuratedListProps) {
  const t = useT('rankings');
  const { plural } = useI18n();
  const { publication, loading, error } = useCuratedRanking(CURATED_SLUG);

  const rows = useMemo(() => (publication?.payload.entries ?? []).map((entry) => ({
    entry,
    game: gamesByKey.get(`${entry.platform}:${entry.externalId}`) ?? null,
  })), [publication, gamesByKey]);

  if (loading) return <SkeletonList />;
  if (error) return <ErrorState title={t('curated.errorTitle')} message={error} onRetry={() => window.location.reload()} />;
  if (!publication) {
    return (
      <div className="empty-state">
        <strong>{t('curated.unpublishedTitle')}</strong>
        <span><RichText text={t('curated.unpublishedBody')} codeClassName="" /></span>
        <Link to="/comunidade" className="btn btn-secondary">{t('curated.communityLink')}</Link>
      </div>
    );
  }

  const language = contentLang(publication);
  const owned = rows.filter((row) => row.game !== null);
  const completed = owned.filter((row) => row.game && isDone(row.game)).length;

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="ranking-title">
      <SectionHead
        className="sh-wrap"
        number="01"
        title={<span id="ranking-title" lang={language}>{publication.title}</span>}
        action={
          <span className="text-xs text-gray-500">
            {withSlots(t('curated.youHave'), {
              owned: <span className="num text-gray-100">{owned.length}</span>,
              total: <span className="num text-gray-100">{rows.length}</span>,
            })}
            {completed > 0 && <> · {withSlots(plural('rankings.curated.completed', completed, { count: '{count}' }), { count: <span className="num text-gray-100">{completed}</span> })}</>}
          </span>
        }
      />
      <div className="-mt-3 space-y-2">
        <p className="lede max-w-3xl" lang={language}>{publication.summary}</p>
        <Attribution publication={publication} />
      </div>
      <ListHead />
      <ol className="rk-list">
        {rows.map(({ entry, game }, index) => {
          const key = `${entry.platform}:${entry.externalId}`;
          if (game) {
            return (
              <RankItem
                key={key}
                rank={index + 1}
                cover={<GameCover game={game} portrait className="h-full w-full" imgClassName="object-cover" />}
                title={game.name}
                detail={entry.note}
                detailLang={language}
                platform={entry.platform}
                situation={<Situation game={game} />}
                estimate={entry.estimate ?? '—'}
                to={`/game/${game.appid}`}
                note={notes.get(game.id)}
              />
            );
          }
          const isSteam = entry.platform === 'steam';
          return (
            <RankItem
              key={key}
              rank={index + 1}
              cover={isSteam
                ? <StoreCover appid={entry.externalId} title={entry.title} className="h-full w-full" />
                : <span className="grid h-full w-full place-items-center bg-gray-850 p-1 text-center font-display text-[9px] font-bold leading-tight text-gray-500">{entry.title}</span>}
              title={isSteam ? (
                <a href={steamStoreUrl(entry.externalId)} target="_blank" rel="noopener noreferrer" className="rk-store-link">
                  {entry.title}<ExternalLink className="h-3 w-3 shrink-0" aria-label={t('curated.storeLink')} />
                </a>
              ) : entry.title}
              detail={entry.note}
              detailLang={language}
              platform={entry.platform}
              situation={<span className="rk-state text-gray-500">{t('situation.outOfLibrary')}</span>}
              estimate={entry.estimate ?? '—'}
              muted
            />
          );
        })}
      </ol>
    </section>
  );
}

export default function Rankings() {
  const t = useT('rankings');
  const { games, loading: gamesLoading } = useSteam();
  const { lists, loading: listsLoading, error: listsError, retry } = useAutoRankings();
  const { notes } = useGameNotes();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = asTab(searchParams.get(LIST_PARAM));
  const [history, setHistory] = useState<{ platinums: CompletionHistoryItem[]; perfects: CompletionHistoryItem[] }>({
    platinums: [],
    perfects: [],
  });
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetchRecentCompletions(8)
      .then(setHistory)
      .finally(() => setHistoryLoading(false));
  }, []);

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const gamesByKey = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of games) {
      if (game.platform && game.platformGameId) map.set(`${game.platform}:${game.platformGameId}`, game);
    }
    return map;
  }, [games]);

  const activeList = lists.find((list) => list.id === active) ?? null;
  const eligible = new Set(lists.flatMap((list) => list.entries.map((entry) => entry.gameId))).size;

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams);
    if (id === 'finish') next.delete(LIST_PARAM);
    else next.set(LIST_PARAM, id);
    setSearchParams(next, { replace: true });
  }

  const noGames = !gamesLoading && games.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="page-eyebrow">{t('page.eyebrow')}</span>
          <h1 className="page-title">{t('page.title')}</h1>
          <p className="page-desc">{t('page.description')}</p>
        </div>
        <div className="page-actions">
          <Link to="/comunidade" className="btn btn-secondary">{t('page.communityLink')}</Link>
        </div>
      </header>

      {!noGames && (
        <p className="lede">
          <span className="num">{games.length}</span> {t.plural('page.games', games.length)}
          {!listsLoading && !listsError && <> · <span className="num">{eligible}</span> {t.plural('page.eligible', eligible)}</>}
        </p>
      )}

      <div className="tabs-bar">
        <div className="subtabs" role="group" aria-label={t('page.tabsLabel')}>
          {lists.map((list) => (
            <button key={list.id} type="button" aria-pressed={list.id === active} onClick={() => selectTab(list.id)} className="subtab">
              <span className="sm:hidden">{t(LIST_KEYS[list.id].short)}</span>
              <span className="hidden sm:inline">{t(LIST_KEYS[list.id].label)}</span>
            </button>
          ))}
          <button type="button" aria-pressed={active === CURATED_TAB} onClick={() => selectTab(CURATED_TAB)} className="subtab">{t('lists.essentials.label')}</button>
        </div>
      </div>

      <div className="grid items-start gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {active === CURATED_TAB ? (
            <CuratedList gamesByKey={gamesByKey} notes={notes} />
          ) : noGames ? (
            <NoGamesState />
          ) : listsError ? (
            <ErrorState title={t('error.title')} message={listsError} onRetry={retry} />
          ) : listsLoading || gamesLoading || !activeList ? (
            <SkeletonList />
          ) : (
            <AutoList list={activeList} gamesById={gamesById} notes={notes} />
          )}
        </div>

        <aside className="space-y-8 xl:sticky xl:top-0">
          {historyLoading ? (
            <div className="h-80 animate-pulse rounded-sm bg-gray-900" />
          ) : (
            <>
              <RecentSection number="02" title={t('recent.platinumsTitle')} subtitle={t('recent.platinumsSubtitle')} items={history.platinums} />
              <RecentSection number="03" title={t('recent.perfectsTitle')} subtitle={t('recent.perfectsSubtitle')} items={history.perfects} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
