/*
  Plano de jogo out/2026 → out/2027: backlog arrojado montado em 13/10/2026.
  Documento de origem: .artefacts/plans/2026-10-13-backlog-out26-nov27.md

  Princípio: blocos contínuos. Cada jogo ou série é jogado de ponta a ponta
  (jogo base → DLCs → sequência/lançamento) sem intervalo, e blocos de
  franquia terminam na véspera do próximo lançamento dela.

  Capacidade: 44 h/semana (40 h base + 10%), mais 6 h por feriado em dia útil
  e 6 h por dia útil de férias. Horas por jogo são estimativas (±30%) do tipo
  HowLongToBeat completionist, ajustadas pelo que falta em cada lista.

  Entradas com `ref` casam com a biblioteca por (platform, platformGameId) e
  mostram progresso real. Entradas sem `ref` são jogos/DLCs fora da biblioteca
  (GTA VI no PS5, Revelation, Songs of the Past).
  `target` é a % que conta como "feito" naquela fase: 100 para fechar, menos
  para colheita ou para etapas parciais (ex.: Witcher 3 antes do Death March).
*/

import type { Platform } from '../types/steam';

export const PLAN_CREATED_AT = '2026-10-13';
/** Média de conclusão da Steam (jogos iniciados, incluindo 100%) no export de 01/10/2026. */
export const PLAN_BASELINE_AVG = 55.0;
/** Média projetada ao fim do plano, cumprindo todas as fases. */
export const PLAN_TARGET_AVG = 82.7;
export const PLAN_WEEKLY_HOURS = 44;

export const PLAN_PRINCIPLE =
  'Cada jogo ou série é jogado em bloco contínuo: jogo base, DLCs e sequência ou lançamento em seguida, para nunca esfriar nos controles. Blocos de franquia terminam na véspera do próximo lançamento dela.';

export type PlanKind = 'foco' | 'platina' | 'limpeza' | 'colher';
export type PlanFlag = 'coop' | 'online' | 'risco';

export interface PlanRef {
  platform: Platform;
  id: string;
}

export interface PlanEntry {
  title: string;
  ref?: PlanRef;
  /** jogo fora da biblioteca: onde/quando */
  external?: { label: string; releaseDate?: string; storeAppid?: string };
  hours: number;
  kind: PlanKind;
  /** % que conta como concluído nesta etapa (padrão 100) */
  target?: number;
  note?: string;
  flags?: PlanFlag[];
}

export interface PlanPhase {
  id: string;
  title: string;
  start: string;
  end: string;
  capacity: number;
  summary: string;
  /** datas são palpite e o bloco desliza com um lançamento sem data */
  floating?: boolean;
  entries: PlanEntry[];
}

export interface PlanMilestone {
  title: string;
  date: string | null;
  label: string;
  note: string;
}

export interface PlanVacation {
  id: string;
  start: string;
  end: string;
  days: number;
  purpose: string;
  note: string;
}

export interface PlanLooseGame {
  title: string;
  ref: PlanRef;
  hours?: number;
  reason: string;
}

export const KIND_LABEL: Record<PlanKind, string> = {
  foco: 'Foco',
  platina: 'Platina aberta',
  limpeza: 'Fechar',
  colher: 'Colher',
};

export const FLAG_LABEL: Record<PlanFlag, string> = {
  coop: 'Precisa de galera',
  online: 'Online',
  risco: 'Ver riscos',
};

const steam = (id: string): PlanRef => ({ platform: 'steam', id });
const psn = (id: string): PlanRef => ({ platform: 'psn', id });

export const MILESTONES: PlanMilestone[] = [
  { title: 'GTA VI', date: '2026-11-19', label: '19/11/2026', note: 'PS5. Platina em bloco único. O feriado de 20/11 fecha 4 dias seguidos.' },
  { title: 'FF VII Revelation', date: '2027-04-08', label: '08/04/2027', note: 'Clássico → Remake → Rebirth terminam na véspera.' },
  { title: 'Witcher 3: Songs of the Past', date: null, label: '2027, sem data', note: 'Bloco Witcher termina na véspera. Palpite: mai–jun, até a CDPR anunciar a data.' },
  { title: 'Kingdom Hearts IV', date: '2027-11-01', label: 'nov/2027 (premissa)', note: 'KH 1.5+2.5 → 2.8 → III terminam em 31/10.' },
];

export const VACATIONS: PlanVacation[] = [
  { id: 'A', start: '2027-02-01', end: '2027-02-07', days: 7, purpose: 'Sprint do Rebirth', note: 'Com o Carnaval, são 11 dias seguidos (30/01 → 10/02).' },
  { id: 'B', start: '2027-04-08', end: '2027-04-16', days: 9, purpose: 'Lançamento do Revelation', note: 'Emenda direto no Rebirth recém-fechado.' },
  { id: 'C', start: '2027-08-16', end: '2027-08-29', days: 14, purpose: 'KH2FM Critical + Data Org', note: 'Cai quando a sequência do 1.5+2.5 chega no KH2FM.' },
];

export const PHASES: PlanPhase[] = [
  {
    id: 'F1',
    title: 'Platinas abertas + limpeza rápida',
    start: '2026-10-13',
    end: '2026-11-18',
    capacity: 239,
    summary: 'Antes do GTA VI: fechar as platinas que você citou e os abertos de maior ganho por hora. O Remnant é feito com as DLCs logo em seguida.',
    entries: [
      { title: 'Remnant: From the Ashes — base + DLCs', ref: steam('617290'), hours: 60, kind: 'platina', note: 'Swamps of Corsus e Subject 2923 logo depois do base, no mesmo personagem.' },
      { title: 'Buckshot Roulette', ref: steam('2835570'), hours: 4, kind: 'platina', note: '1000K e Know When To Quit saem na mesma run.' },
      { title: 'Chained Together', ref: steam('2567870'), hours: 8, kind: 'platina', note: 'Cume em < 1h50 e modo lava.' },
      { title: 'The Spell Brigade', ref: steam('2904000'), hours: 20, kind: 'platina', note: '13 restantes (ganhou conquistas novas).' },
      { title: 'DRAGON BALL: Sparking! ZERO', ref: steam('1790600'), hours: 20, kind: 'platina', note: '100 batalhas online, de fundo (~4 h/semana).', flags: ['online'] },
      { title: 'Mechanism', ref: steam('645290'), hours: 5, kind: 'limpeza', note: '+83 pp em ~5 h: o melhor ganho da biblioteca.' },
      { title: 'Welcome to the Game', ref: steam('485380'), hours: 8, kind: 'limpeza' },
      { title: 'JASEM', ref: steam('610840'), hours: 10, kind: 'limpeza' },
      { title: 'Life is Strange', ref: steam('319630'), hours: 8, kind: 'limpeza', note: 'Os 5 episódios em sequência, com guia de fotos.' },
      { title: 'Castle Crashers', ref: steam('204360'), hours: 15, kind: 'limpeza', flags: ['coop'] },
      { title: 'How to Fish', ref: steam('4001890'), hours: 4, kind: 'limpeza' },
      { title: 'How Many Dudes?', ref: steam('3934270'), hours: 20, kind: 'limpeza' },
      { title: 'Ori and the Blind Forest', ref: steam('387290'), hours: 20, kind: 'limpeza' },
      { title: 'Among Us', ref: steam('945360'), hours: 10, kind: 'colher', target: 43 },
      { title: 'EA SPORTS FIFA 23', ref: steam('1811260'), hours: 5, kind: 'colher', target: 62 },
    ],
  },
  {
    id: 'F2',
    title: 'GTA VI',
    start: '2026-11-19',
    end: '2026-12-31',
    capacity: 282,
    summary: 'GTA VI em bloco único: campanha e platina sem interrupção. As outras platinas de PS5 aproveitam o console ligado.',
    entries: [
      { title: 'GTA VI — campanha + platina', external: { label: 'PS5', releaseDate: '2026-11-19' }, hours: 120, kind: 'foco', note: 'Renove o NPSSO da PSN antes, senão o sync não registra.' },
      { title: 'God of War: Chains of Olympus', ref: psn('NPWR02070_00'), hours: 12, kind: 'platina' },
      { title: "Marvel's Spider-Man: Miles Morales", ref: psn('NPWR20684_00'), hours: 20, kind: 'platina' },
      { title: 'Risk of Rain Returns', ref: steam('1337520'), hours: 10, kind: 'colher', target: 25, note: 'Em dupla com o Risk of Rain 2.' },
      { title: 'Risk of Rain 2', ref: steam('632360'), hours: 15, kind: 'colher', target: 32 },
      { title: "Another Crab's Treasure", ref: steam('1887840'), hours: 25, kind: 'limpeza' },
      { title: 'GTA III — The Definitive Edition', ref: steam('1546970'), hours: 25, kind: 'limpeza' },
      { title: 'Rift of the NecroDancer', ref: steam('2073250'), hours: 25, kind: 'limpeza' },
    ],
  },
  {
    id: 'F3',
    title: 'Trilogia FF VII',
    start: '2027-01-01',
    end: '2027-04-07',
    capacity: 664,
    summary: 'Clássico → relançamento → Remake → Rebirth em sequência, terminando na véspera do Revelation. As férias A + Carnaval são do Rebirth.',
    entries: [
      { title: 'FINAL FANTASY VII (2013) — 100%', ref: steam('39140'), hours: 60, kind: 'foco', note: 'jan. Já está aberto e puxa a média. Use os boosters.' },
      { title: 'FINAL FANTASY VII (relançamento) — 100%', ref: steam('3837340'), hours: 30, kind: 'foco', note: 'Logo em seguida, com a rota fresca. 3x velocidade.' },
      { title: 'FINAL FANTASY VII REMAKE INTERGRADE — 100%', ref: steam('1462040'), hours: 90, kind: 'foco', note: 'Base e INTERmission (Yuffie) em sequência.' },
      { title: 'FINAL FANTASY VII REBIRTH — 100%', ref: steam('2909400'), hours: 140, kind: 'foco', note: 'Férias A + Carnaval → 07/04. Platina mais pesada da lista.', flags: ['risco'] },
      { title: 'Resident Evil 5', ref: steam('21690'), hours: 15, kind: 'platina', note: 'Versus: só com parceiro de boost combinado.', flags: ['online', 'coop'] },
      { title: 'PEAK', ref: steam('3527290'), hours: 25, kind: 'platina', flags: ['coop'] },
      { title: '7 Billion Humans', ref: steam('792100'), hours: 22, kind: 'limpeza' },
      { title: 'Schedule I', ref: steam('3164500'), hours: 20, kind: 'limpeza' },
      { title: 'Cuphead', ref: steam('268910'), hours: 35, kind: 'limpeza', note: 'Base e Delicious Last Course em sequência.' },
      { title: 'Dead Rising 2', ref: steam('45740'), hours: 40, kind: 'limpeza' },
      { title: '9 Kings', ref: steam('2784470'), hours: 20, kind: 'limpeza' },
      { title: 'Injustice: Gods Among Us', ref: steam('242700'), hours: 40, kind: 'limpeza' },
      { title: 'Monster Prom', ref: steam('743450'), hours: 25, kind: 'limpeza' },
      { title: 'Escape the Backrooms', ref: steam('1943950'), hours: 6, kind: 'limpeza', flags: ['coop'] },
      { title: 'Destiny 2', ref: steam('1085660'), hours: 20, kind: 'colher', target: 54 },
      { title: 'Esports Godfather', ref: steam('1278540'), hours: 10, kind: 'colher', target: 37 },
      { title: 'Sea of Thieves', ref: steam('1172620'), hours: 8, kind: 'colher', target: 12 },
      { title: 'DEVOUR', ref: steam('1274570'), hours: 8, kind: 'colher', target: 15 },
    ],
  },
  {
    id: 'F4',
    title: 'Revelation',
    start: '2027-04-08',
    end: '2027-04-30',
    capacity: 193,
    summary: 'Revelation emendado no Rebirth, nas férias B.',
    entries: [
      { title: 'FINAL FANTASY VII REVELATION — campanha', external: { label: 'Lançamento', releaseDate: '2027-04-08', storeAppid: '4354570' }, hours: 60, kind: 'foco', note: 'Na Steam entra na média: ou PS5, ou platina depois.', flags: ['risco'] },
      { title: 'For The King', ref: steam('527230'), hours: 30, kind: 'limpeza' },
      { title: 'NARUTO SHIPPUDEN: Storm 4', ref: steam('349040'), hours: 40, kind: 'limpeza' },
      { title: 'GTA V Legacy', ref: steam('271590'), hours: 30, kind: 'colher', target: 36 },
      { title: 'Bloons TD 6', ref: steam('960090'), hours: 15, kind: 'colher', target: 40 },
    ],
  },
  {
    id: 'F5',
    title: 'Bloco Witcher',
    start: '2027-05-01',
    end: '2027-06-30',
    capacity: 389,
    floating: true,
    summary: 'W2 → W3 base → HoS → B&W → NG+ Death March, terminando na véspera do Songs of the Past para entrar no DLC com a mecânica fresca. As datas são palpite: quando a CDPR anunciar, o bloco desliza para terminar na véspera.',
    entries: [
      { title: 'The Witcher 2 — 100%', ref: steam('20920'), hours: 70, kind: 'foco', note: 'Run de 100% primeiro, Insane separado com backup do save.', flags: ['risco'] },
      { title: 'The Witcher 3 — final do base + HoS + B&W', ref: steam('292030'), hours: 55, kind: 'foco', target: 98, note: 'Do save de 130 h direto para as DLCs. Tudo menos o Walked the Path (77/78).' },
      { title: 'The Witcher 3 — Walked the Path (NG+ Death March)', ref: steam('292030'), hours: 35, kind: 'foco', note: 'Emendado no B&W. Só se o save não for Death March desde o início.', flags: ['risco'] },
      { title: 'Witcher 3: Songs of the Past', external: { label: 'DLC · 2027' }, hours: 25, kind: 'foco', note: 'Day one, no save NG+ Death March. Deve adicionar conquistas ao W3.' },
      { title: 'Blue Prince', ref: steam('1569580'), hours: 50, kind: 'limpeza' },
      { title: 'Hades', ref: steam('1145360'), hours: 60, kind: 'limpeza' },
      { title: 'CODE VEIN', ref: steam('678960'), hours: 50, kind: 'limpeza' },
    ],
  },
  {
    id: 'F6',
    title: 'Kingdom Hearts',
    start: '2027-07-01',
    end: '2027-10-31',
    capacity: 845,
    summary: 'KH 1.5+2.5 → 2.8 → III + Re Mind em sequência, terminando na véspera do KH IV. Pares da mesma série também em sequência (Borderlands).',
    entries: [
      { title: 'KINGDOM HEARTS HD 1.5+2.5 ReMIX — 100%', ref: steam('2552430'), hours: 250, kind: 'foco', note: 'jul → ago. KH FM → Re:CoM → BbS → KH2FM (férias C).' },
      { title: 'KINGDOM HEARTS HD 2.8 — 100%', ref: steam('2552440'), hours: 65, kind: 'foco', note: 'set.' },
      { title: 'KINGDOM HEARTS III + Re Mind — 100%', ref: steam('2552450'), hours: 85, kind: 'foco', note: 'out. Base e Re Mind em sequência, até 31/10.' },
      { title: 'Devil May Cry 4 SE', ref: steam('329050'), hours: 60, kind: 'limpeza' },
      { title: 'Horizon Zero Dawn', ref: steam('1151640'), hours: 50, kind: 'limpeza', note: 'Base e Frozen Wilds em sequência.' },
      { title: 'Borderlands GOTY', ref: steam('8980'), hours: 45, kind: 'limpeza', note: 'Logo antes do Borderlands 2.' },
      { title: 'Borderlands 2', ref: steam('49520'), hours: 45, kind: 'limpeza' },
      { title: 'Rise of the Tomb Raider', ref: steam('391220'), hours: 70, kind: 'limpeza' },
      { title: 'Sekiro: Shadows Die Twice', ref: steam('814380'), hours: 70, kind: 'limpeza' },
    ],
  },
];

/** Jogado toda semana, fora das fases. */
export const RECURRING: PlanEntry = {
  title: 'EA SPORTS FC 27',
  ref: steam('4080220'),
  hours: 3,
  kind: 'platina',
  target: 70,
  note: '3 h/semana até o FC 28 sair (~165 h no período). Meta: 70%.',
};

export const AFTER_PLAN: PlanLooseGame[] = [
  { title: 'FINAL FANTASY IX', ref: steam('377840'), hours: 70, reason: '1º a puxar se o plano adiantar' },
  { title: 'FINAL FANTASY TACTICS', ref: steam('1004640'), hours: 70, reason: '2º da fila' },
  { title: 'Cyberpunk 2077', ref: steam('1091500'), hours: 90, reason: '3º da fila · base + Phantom Liberty em sequência' },
  { title: 'DARK SOULS: REMASTERED', ref: steam('570940'), hours: 90, reason: '4º da fila · logo depois do Sekiro' },
  { title: "Baldur's Gate 3", ref: steam('1086940'), hours: 100, reason: '5º da fila · mais de um playthrough' },
  { title: 'Palworld', ref: steam('1623730'), hours: 80, reason: 'Não coube na F6' },
  { title: 'Slay the Spire', ref: steam('646570'), hours: 80, reason: 'Grind de ascensões' },
  { title: 'Dying Light', ref: steam('239140'), hours: 80, reason: 'Longo' },
  { title: 'Megabonk', ref: steam('3405340'), hours: 30, reason: 'Cauda longa de desbloqueios' },
  { title: 'Skyrim Special Edition', ref: steam('489830'), hours: 120, reason: 'Longo' },
  { title: 'Darkest Dungeon', ref: steam('262060'), hours: 20, reason: 'Só colheita' },
];

export const ACCEPT_AS_IS: PlanLooseGame[] = [
  { title: 'Lost Ark', ref: steam('1599340'), reason: 'MMO, mediana de raridade 0,6%' },
  { title: 'Call of Duty', ref: steam('1938090'), reason: '138 restantes, mediana 0,6%' },
  { title: 'Aimlabs', ref: steam('714010'), reason: 'Skill puro, mediana 0,8%' },
  { title: 'Brawlhalla', ref: steam('291550'), reason: 'Grind online' },
  { title: 'Fall Guys', ref: steam('1097150'), reason: 'Classificar em 500 rodadas' },
  { title: 'Apex Legends', ref: steam('1172470'), reason: 'Nível 50 + vitória com 8 lendas' },
  { title: 'Crimson Desert', ref: steam('3321460'), reason: 'Mediana das restantes: 0,8%' },
  { title: 'Hollow Knight: Silksong', ref: steam('1030300'), reason: 'Steel Soul: skill no teto' },
  { title: 'Ghost of Tsushima (Steam)', ref: steam('2215430'), reason: 'Legends online + NG+' },
  { title: 'Ghost of Tsushima (PSN)', ref: psn('NPWR22859_00'), reason: 'Mesmas 10 pendências' },
];

export const IF_TIME: PlanLooseGame[] = [
  { title: 'Ghost of Yōtei', ref: psn('NPWR51746_00'), hours: 60, reason: 'PS5' },
  { title: 'Pokémon FireRed', ref: { platform: 'retroachievements', id: '515' }, hours: 40, reason: 'RetroAchievements' },
];

export const RISKS: { risk: string; action: string }[] = [
  { risk: 'Songs of the Past ganhar data', action: 'O bloco Witcher (~185 h) desliza para terminar na véspera. Se cair em nov ou depois, troca de lugar com o KH e vai para depois do KH IV.' },
  { risk: 'Save do Witcher 3 não é Death March desde o início', action: 'Confira antes de terminar o base. Se já for, as 35 h viram folga no bloco.' },
  { risk: 'Witcher 2 Insane: morte permanente', action: 'Run separado depois do 100%, com backup manual do save.' },
  { risk: 'GTA VI adiar de novo', action: 'As 120 h da F2 vão para o FF VII clássico, adiantando a trilogia.' },
  { risk: 'Rebirth escorregar', action: 'Minigames ficam para depois de 08/04; a história não.' },
  { risk: 'KH IV sair antes de nov', action: 'KH III é o último da sequência: se o KH IV vier em out, puxe o bloco para antes.' },
  { risk: 'Sync da PSN quebrado (NPSSO)', action: 'Renovar ZENKURI_PSN_NPSSO antes de 19/11.' },
  { risk: 'Revelation na Steam', action: 'Entra na média: jogue no PS5 ou planeje a platina depois.' },
];
