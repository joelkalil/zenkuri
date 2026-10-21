import { Check } from 'lucide-react';
import { Stamp } from './Stamp';
import type { AchievementWithStatus, Platform } from '../types/steam';

interface AchievementListProps {
  achievements: AchievementWithStatus[];
  platform?: Platform;
}

const percentFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  platinum: 'Platina',
  gold: 'Ouro',
  silver: 'Prata',
  bronze: 'Bronze',
};

const TYPE_ICON: Record<string, string> = {
  platinum: '/trophies/platinum.png',
  gold: '/trophies/gold.png',
  silver: '/trophies/silver.png',
  bronze: '/trophies/bronze.png',
};

const TYPE_COLOR: Record<string, string> = {
  platinum: 'text-zk-platinum',
  gold: 'text-zk-gold',
  silver: 'text-zk-silver',
  bronze: 'text-zk-bronze',
};

/** Checklist em tabela densa: nº, imagem, nome + descrição, tipo/pontos, raridade, data e estado. */
export function AchievementList({ achievements }: AchievementListProps) {
  if (achievements.length === 0) {
    return <p className="py-10 text-sm text-gray-500">Nenhum troféu encontrado para este filtro.</p>;
  }

  return (
    <div role="table" aria-label="Troféus do jogo" className="trophy-table">
      <div role="row" className="trophy-head col-head">
        <span role="columnheader" className="r">#</span>
        <span role="columnheader"><span className="sr-only">Imagem</span></span>
        <span role="columnheader">Troféu</span>
        <span role="columnheader" className="trophy-hide-sm">Tipo</span>
        <span role="columnheader" className="r">Raridade</span>
        <span role="columnheader" className="r trophy-hide-sm">Obtido em</span>
        <span role="columnheader"><span className="sr-only">Estado</span></span>
      </div>
      {achievements.map((a, index) => {
        const earned = a.achieved;
        const type = a.type;
        const trophyIcon = type ? TYPE_ICON[type] : undefined;
        const hasRarity = typeof a.rarity === 'number' && a.rarity > 0;
        return (
          <div key={a.name} role="row" className="trophy-row" data-earned={earned} data-platinum={type === 'platinum'}>
            <span role="cell" className="n r">{index + 1}</span>
            <span role="cell">
              <img
                src={earned ? a.icon : a.icongray}
                alt=""
                className={`trophy-img ${earned ? '' : 'grayscale opacity-60'}`}
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
              />
            </span>
            <span role="cell" className="min-w-0">
              <span className="trophy-name">{a.displayName || a.name}</span>
              <span className="trophy-desc">{a.hidden && !earned ? 'Troféu oculto' : a.description || 'Sem descrição'}</span>
            </span>
            <span role="cell" className="trophy-hide-sm trophy-type">
              {trophyIcon && type ? (
                <>
                  <img src={trophyIcon} alt="" />
                  <span className={TYPE_COLOR[type] ?? 'text-gray-300'}>{TYPE_LABEL[type]}</span>
                </>
              ) : typeof a.points === 'number' && a.points > 0 ? (
                <span className="num">{a.points} pts</span>
              ) : null}
            </span>
            <span role="cell" className="num r">{hasRarity ? `${percentFormat.format(a.rarity as number)}%` : '—'}</span>
            <span role="cell" className="num r trophy-hide-sm trophy-date">{earned && a.unlocktime > 0 ? fmtDate(a.unlocktime) : '—'}</span>
            <span role="cell" className="trophy-state">
              {earned ? (
                type === 'platinum' && a.unlocktime > 0
                  ? <Stamp kind="platina" size={24} seed={a.name} />
                  : <span className="trophy-mark" role="img" aria-label={`Obtido${a.unlocktime > 0 ? ` em ${fmtDate(a.unlocktime)}` : ''}`}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
              ) : (
                <span className="trophy-open" role="img" aria-label="Bloqueado" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
