/*
  Sagas: catálogo curado de franquias com a ordem recomendada para platinar.

  Critério (híbrido): eficiência como regra (custo real para fechar, boosters,
  dependência de online), mas arcos de história ficam juntos e versões
  alternativas do mesmo jogo são jogadas em sequência para aproveitar a rota
  fresca. Escopo: todo jogo da franquia que existe na Steam.

  Jogos que o usuário tem casam com a biblioteca por (steam, appid) e mostram
  progresso real; os demais mostram preço e link da loja. Preços em BRL, preço
  cheio consultado na Steam em PRICE_CHECKED_AT — mudam com promoções.
  Estimativas de horas são para a lista inteira de conquistas da Steam.
*/

export const PRICE_CHECKED_AT = '2026-10-01';

export type SagaFlag = 'online' | 'missable' | 'legacy';

/** 1 tranquila · 2 leve · 3 média · 4 exigente · 5 brutal */
export type SagaDifficulty = 1 | 2 | 3 | 4 | 5;

export interface SagaEntry {
  /** appid da Steam */
  appid: string;
  title: string;
  year: number;
  achievements: number;
  /** faixa de horas para a lista inteira */
  hours: [number, number];
  difficulty: SagaDifficulty;
  /** preço cheio em BRL na data PRICE_CHECKED_AT; 0 = gratuito */
  priceBRL: number | null;
  note: string;
  flags?: SagaFlag[];
}

export interface SagaPhase {
  id: string;
  title: string;
  summary: string;
  entries: SagaEntry[];
}

export interface SagaOutOfScope {
  appid: string;
  title: string;
  reason: string;
}

export interface Saga {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  method: string;
  phases: SagaPhase[];
  outOfScope: SagaOutOfScope[];
}

export const DIFFICULTY_LABEL: Record<SagaDifficulty, string> = {
  1: 'Tranquila',
  2: 'Leve',
  3: 'Média',
  4: 'Exigente',
  5: 'Brutal',
};

export const FLAG_LABEL: Record<SagaFlag, string> = {
  online: 'Depende de online',
  missable: 'Tem perdíveis',
  legacy: 'Fora de venda',
};

const FINAL_FANTASY: Saga = {
  slug: 'final-fantasy',
  name: 'Final Fantasy',
  shortName: 'FF',
  tagline: 'Do cristal de 1987 ao Valisthea: todos os Final Fantasy da Steam, na ordem que mais rende platina.',
  method:
    'Começa pelos Pixel Remaster (boosts oficiais, listas curtas) para ganhar ritmo. Versões alternativas do mesmo jogo vêm em sequência, a compilação de FF VII e a trilogia XIII seguem a ordem da história, e o que depende de online fica para o fim.',
  phases: [
    {
      id: 'pixel',
      title: 'Aquecimento em pixel',
      summary:
        'Os Pixel Remaster têm boosts oficiais de EXP, gil e encontros. Nenhuma conquista online, e a ordem de lançamento acompanha a curva de duração.',
      entries: [
        { appid: '1173770', title: 'FINAL FANTASY', year: 2021, achievements: 24, hours: [12, 15], difficulty: 1, priceBRL: 27, note: 'O ponto de partida e a régua de ritmo dos Pixel Remaster.' },
        { appid: '1173780', title: 'FINAL FANTASY II', year: 2021, achievements: 28, hours: [15, 20], difficulty: 1, priceBRL: 27, note: 'Evolução por uso; os boosts aceleram o grind de atributos. Bestiário com checklist ao lado.' },
        { appid: '1173790', title: 'FINAL FANTASY III', year: 2021, achievements: 31, hours: [20, 25], difficulty: 2, priceBRL: 42, note: 'Sistema de jobs com boost de EXP; bestiário e mapa completo são o grosso da lista.' },
        { appid: '1173800', title: 'FINAL FANTASY IV', year: 2021, achievements: 30, hours: [20, 25], difficulty: 2, priceBRL: 42, note: 'Linear e sem grind pesado; a Lunar Subterrane concentra os inimigos raros.' },
        { appid: '1173810', title: 'FINAL FANTASY V', year: 2021, achievements: 39, hours: [30, 40], difficulty: 2, priceBRL: 42, note: 'Dominar todos os jobs é a conquista mais longa, e o boost de ABP resolve. Omega e Shinryu testam a build.' },
        { appid: '1173820', title: 'FINAL FANTASY VI', year: 2022, achievements: 37, hours: [40, 50], difficulty: 3, priceBRL: 42, note: 'Bestiário com inimigos perdíveis antes do colapso do mundo: siga um guia na primeira metade.', flags: ['missable'] },
      ],
    },
    {
      id: 'remakes-3d',
      title: 'Remakes 3D e o epílogo de IV',
      summary:
        'Versões alternativas de III e IV com listas próprias. Logo depois dos Pixel Remaster, a história ainda está fresca, e The After Years continua direto do IV.',
      entries: [
        { appid: '239120', title: 'Final Fantasy III (3D Remake)', year: 2014, achievements: 18, hours: [40, 50], difficulty: 3, priceBRL: 14.99, note: 'Poucas conquistas, mas o equipamento Onion e os job levels altos pedem farm dedicado.' },
        { appid: '312750', title: 'Final Fantasy IV (3D Remake)', year: 2014, achievements: 58, hours: [50, 60], difficulty: 3, priceBRL: 14.99, note: 'Parte da lista exige New Game+: planeje os augments da primeira run pensando na segunda.', flags: ['missable'] },
        { appid: '346830', title: 'FINAL FANTASY IV: THE AFTER YEARS', year: 2015, achievements: 50, hours: [40, 60], difficulty: 3, priceBRL: 18.74, note: 'Capítulos por personagem e o desafio pós-jogo; bestiário e bandos completos são o grind.' },
      ],
    },
    {
      id: 'ps1',
      title: 'Clássicos de PS1 com boosters',
      summary:
        'As versões Steam trazem velocidade 3x, encontros desligáveis e boosters de status. VII e VIII têm duas listas cada: jogue as duas versões em sequência.',
      entries: [
        { appid: '3837340', title: 'FINAL FANTASY VII', year: 2013, achievements: 31, hours: [40, 50], difficulty: 3, priceBRL: 7.99, note: 'Ruby e Emerald Weapon, chocobo dourado e Master Materia. Os boosters cortam o grind de AP.' },
        { appid: '39140', title: 'FINAL FANTASY VII (2013)', year: 2013, achievements: 36, hours: [25, 35], difficulty: 2, priceBRL: null, note: 'Versão antiga, fora de venda mas na sua conta. Lista separada; com o booster de personagem, a segunda run vira passeio.', flags: ['legacy'] },
        { appid: '1026680', title: 'FINAL FANTASY VIII - REMASTERED', year: 2019, achievements: 34, hours: [45, 60], difficulty: 3, priceBRL: 24, note: 'Triple Triad completo e GFs perdíveis são o risco; velocidade 3x e encontros desligados salvam o farm.', flags: ['missable'] },
        { appid: '39150', title: 'FINAL FANTASY VIII', year: 2013, achievements: 45, hours: [40, 55], difficulty: 3, priceBRL: 7.99, note: 'Mesma jornada, lista maior. Logo depois do Remastered, as regras de carta por região ainda estão frescas.', flags: ['missable'] },
        { appid: '377840', title: 'FINAL FANTASY IX', year: 2016, achievements: 85, hours: [60, 100], difficulty: 4, priceBRL: 11.84, note: 'Excalibur II exige fechar em menos de 12h de relógio do jogo, e o modo 3x acelera o relógio junto. Planeje uma run dedicada.', flags: ['missable'] },
      ],
    },
    {
      id: 'compilation-vii',
      title: 'Compilação de FF VII',
      summary:
        'Ordem da história: Crisis Core prepara o peso emocional de Remake e Rebirth. As três listas pedem dificuldade máxima, então o domínio do combate se acumula.',
      entries: [
        { appid: '1608070', title: 'CRISIS CORE –FINAL FANTASY VII– REUNION', year: 2022, achievements: 51, hours: [60, 80], difficulty: 3, priceBRL: 76.96, note: 'As 300 missões são o grosso da lista; o Hard fica tranquilo com materia fundida.' },
        { appid: '1462040', title: 'FINAL FANTASY VII REMAKE INTERGRADE', year: 2022, achievements: 63, hours: [80, 100], difficulty: 4, priceBRL: 43.72, note: 'Hard Mode com seleção de capítulo, Combat Simulator e o INTERmission da Yuffie na mesma lista.' },
        { appid: '2909400', title: 'FINAL FANTASY VII REBIRTH', year: 2025, achievements: 61, hours: [130, 170], difficulty: 5, priceBRL: 65.97, note: 'A mais longa da saga: Queen\'s Blood, corridas de chocobo, minigames e os desafios Brutal e Legendary.' },
      ],
    },
    {
      id: 'ps2',
      title: 'Era PS2',
      summary:
        'Os dois jogos com mais grind clássico. As versões Steam têm modo de velocidade, que corta pela metade o farm de Celestiais e de Yiazmat.',
      entries: [
        { appid: '359870', title: 'FINAL FANTASY X/X-2 HD Remaster', year: 2016, achievements: 69, hours: [150, 200], difficulty: 5, priceBRL: 22.39, note: 'Duas platinas numa lista: Celestiais, 200 raios e blitzball no X; 100% de história e Last Mission no X-2, com perdíveis.', flags: ['missable'] },
        { appid: '595520', title: 'FINAL FANTASY XII THE ZODIAC AGE', year: 2018, achievements: 41, hours: [90, 110], difficulty: 4, priceBRL: 49.79, note: 'Trial Mode de 100 fases, todas as caças e Yiazmat. O modo 4x é seu melhor amigo.' },
      ],
    },
    {
      id: 'fabula',
      title: 'Fabula Nova Crystallis',
      summary:
        'Trilogia XIII na ordem da história, depois Type-0 e XV, que dividem a mesma mitologia. Nos três XIII, a lista vive no pós-jogo.',
      entries: [
        { appid: '292120', title: 'FINAL FANTASY XIII', year: 2014, achievements: 35, hours: [80, 100], difficulty: 4, priceBRL: 11.99, note: 'As 64 missões com 5 estrelas e o Treasure Hunter: farm de Adamantoise atrás de trapezoedros.' },
        { appid: '292140', title: 'FINAL FANTASY XIII-2', year: 2014, achievements: 31, hours: [50, 70], difficulty: 3, priceBRL: 14.99, note: 'Os 160 fragmentos e todos os finais paradoxais; a seleção de época facilita a limpeza.' },
        { appid: '345350', title: 'LIGHTNING RETURNS: FINAL FANTASY XIII', year: 2015, achievements: 42, hours: [60, 80], difficulty: 4, priceBRL: 14.99, note: 'Exige New Game+ e domínio do relógio do mundo; o Hard só abre na segunda run.' },
        { appid: '340170', title: 'FINAL FANTASY TYPE-0 HD', year: 2015, achievements: 49, hours: [80, 100], difficulty: 4, priceBRL: 16.79, note: 'Várias runs, 14 personagens e o Agito Mode. O NG+ mantém os níveis, então a segunda run voa.' },
        { appid: '637650', title: 'FINAL FANTASY XV WINDOWS EDITION', year: 2018, achievements: 97, hours: [100, 130], difficulty: 4, priceBRL: 37.5, note: 'A maior lista da saga: pesca, culinária, Pitioss, Adamantoise e os Episodes inclusos.' },
      ],
    },
    {
      id: 'modern',
      title: 'Era moderna e derivados',
      summary:
        'Lançamentos recentes e spin-offs com listas independentes. Tactics já está em andamento; o resto entra conforme o apetite.',
      entries: [
        { appid: '1004640', title: 'FINAL FANTASY TACTICS - The Ivalice Chronicles', year: 2025, achievements: 50, hours: [60, 90], difficulty: 4, priceBRL: 131.94, note: 'Tática densa com colecionáveis de longo prazo; continue de onde parou.' },
        { appid: '2515020', title: 'FINAL FANTASY XVI', year: 2024, achievements: 69, hours: [90, 110], difficulty: 4, priceBRL: 87.96, note: 'Final Fantasy Mode (NG+) obrigatório, rank S nos Chronolith Trials e no Arcade Mode.' },
        { appid: '1358700', title: 'STRANGER OF PARADISE FINAL FANTASY ORIGIN', year: 2023, achievements: 83, hours: [80, 100], difficulty: 4, priceBRL: 59.97, note: 'A dificuldade Chaos e o loot de endgame dominam a lista; Nioh com cristais.' },
        { appid: '552700', title: 'WORLD OF FINAL FANTASY', year: 2017, achievements: 49, hours: [60, 80], difficulty: 3, priceBRL: 29.6, note: 'Coleção de Mirages em clima de Pokémon: leve, mas cheia de colecionáveis.' },
        { appid: '1642620', title: 'COLLECTION of SaGa FINAL FANTASY LEGEND', year: 2021, achievements: 10, hours: [15, 25], difficulty: 2, priceBRL: 45, note: 'Três jogos de Game Boy e só 10 conquistas. Leva o nome FF no Ocidente, mas é SaGa.' },
      ],
    },
    {
      id: 'online',
      title: 'Por último: online',
      summary: 'Conquistas presas a partidas contra outras pessoas. Trate como opcional.',
      entries: [
        { appid: '921590', title: 'DISSIDIA FINAL FANTASY NT Free Edition', year: 2019, achievements: 56, hours: [100, 150], difficulty: 5, priceBRL: 0, note: 'Gratuito, mas as conquistas ranqueadas dependem de uma comunidade pequena e de muito volume.', flags: ['online'] },
      ],
    },
  ],
  outOfScope: [
    { appid: '39210', title: 'FINAL FANTASY XIV Online', reason: 'MMO sem conquistas na Steam: não existe platina para registrar.' },
    { appid: '3259780', title: 'FINAL FANTASY RESONANCE', reason: 'Lança em 22/10/2026; a lista de conquistas sai junto.' },
    { appid: '4354570', title: 'FINAL FANTASY VII REVELATION', reason: 'Previsto para 08/04/2027 e fecha a trilogia do Remake.' },
  ],
};

const RESIDENT_EVIL: Saga = {
  slug: 'resident-evil',
  name: 'Resident Evil',
  shortName: 'RE',
  tagline: 'De Raccoon City à era RE Engine: todos os Resident Evil da Steam, na ordem que mais rende platina.',
  method:
    'Abre com a platina mais barata da franquia e depois segue a ordem da história dentro de cada geração. Os remakes vêm em sequência porque as runs com rank S treinam a mesma habilidade. Tudo que depende de lobby online fica para o fim.',
  phases: [
    {
      id: 'warmup',
      title: 'Aquecimento',
      summary: 'Lista curta, nenhuma dependência de online e um ensaio para o remake mais adiante.',
      entries: [
        { appid: '254700', title: 'Resident Evil 4 (2005)', year: 2014, achievements: 12, hours: [20, 25], difficulty: 2, priceBRL: 89, note: 'Só 12 conquistas: Professional, Separate Ways e Mercenaries. A platina mais barata da franquia.' },
      ],
    },
    {
      id: 'origins',
      title: 'Origens de câmera fixa',
      summary: 'Ordem da história (0 antes de 1). Mesma engine e os mesmos truques de inventário e rota.',
      entries: [
        { appid: '339340', title: 'Resident Evil 0', year: 2016, achievements: 47, hours: [35, 45], difficulty: 3, priceBRL: 89, note: 'Leech Hunter, Wesker Mode e o Hard abaixo do tempo. Sem baú: planeje onde largar cada item.' },
        { appid: '304240', title: 'Resident Evil', year: 2015, achievements: 44, hours: [40, 50], difficulty: 4, priceBRL: 89, note: 'Real Survivor, Invisible Enemy e runs abaixo de 3h. Rota decorada é tudo.' },
      ],
    },
    {
      id: 'remakes',
      title: 'Remakes RE Engine',
      summary: 'RE2 → RE3 → RE4: ordem da história e curva de dificuldade. Cada um ensina a rota e o rank S do seguinte.',
      entries: [
        { appid: '883710', title: 'Resident Evil 2', year: 2019, achievements: 44, hours: [40, 50], difficulty: 4, priceBRL: 169, note: 'Hardcore com rank S para Leon e Claire, 4th Survivor e Tofu. As armas infinitas liberadas por rank aliviam as runs finais.' },
        { appid: '952060', title: 'Resident Evil 3', year: 2020, achievements: 32, hours: [35, 40], difficulty: 4, priceBRL: 169, note: 'Inferno é o pico; a loja de pontos libera armas infinitas e moedas que transformam a run.' },
        { appid: '2050650', title: 'Resident Evil 4', year: 2023, achievements: 46, hours: [70, 100], difficulty: 5, priceBRL: 169, note: 'Professional com rank S+, desafios de arma e Mercenaries. Execução que vale cada tentativa.' },
      ],
    },
    {
      id: 'revelations',
      title: 'Revelations',
      summary: 'Spin-offs entre os numerados, com Raid Mode viciante. Rendem muito melhor com um parceiro.',
      entries: [
        { appid: '222480', title: 'Resident Evil Revelations', year: 2013, achievements: 50, hours: [50, 60], difficulty: 3, priceBRL: 89, note: 'Campanha no Infernal e o Raid Mode até nível alto. Tranquilo em dupla.' },
        { appid: '287290', title: 'Resident Evil Revelations 2', year: 2015, achievements: 43, hours: [45, 55], difficulty: 3, priceBRL: 89, note: 'Invisible Mode e o Raid Mode são o grind; a campanha em episódios é curta.' },
      ],
    },
    {
      id: 'first-person',
      title: 'Primeira pessoa e a era atual',
      summary: 'A história corre direto do 7 para o Village e então para o Requiem. Runs de tempo e dificuldade máxima em cada um.',
      entries: [
        { appid: '418370', title: 'Resident Evil 7 Biohazard', year: 2017, achievements: 58, hours: [40, 50], difficulty: 4, priceBRL: 89, note: 'Madhouse, run abaixo de 4h e no máximo 3 usos do baú. As DLCs entram na lista.' },
        { appid: '1196590', title: 'Resident Evil Village', year: 2021, achievements: 56, hours: [50, 60], difficulty: 4, priceBRL: 169, note: 'Village of Shadows, Mercenaries com rank SS e desafios de arma. A loja de extras ajuda muito.' },
        { appid: '3764200', title: 'Resident Evil Requiem', year: 2026, achievements: 49, hours: [40, 60], difficulty: 4, priceBRL: 299, note: 'Lançamento de 2026: estimativa baseada nos anteriores da RE Engine. Confira a lista antes de investir.' },
      ],
    },
    {
      id: 'coop',
      title: 'Coop pesado',
      summary: 'Quatro campanhas e um modo que depende de outras pessoas online.',
      entries: [
        { appid: '221040', title: 'Resident Evil 6', year: 2013, achievements: 70, hours: [90, 120], difficulty: 4, priceBRL: 89, note: 'Quatro campanhas, No Hope e Mercenaries. Agent Hunt depende de outros jogadores online.', flags: ['online'] },
      ],
    },
    {
      id: 'online',
      title: 'Por último: online e boost',
      summary: 'Conquistas presas a lobby. Só valem com um grupo de boost combinado.',
      entries: [
        { appid: '21690', title: 'Resident Evil 5', year: 2009, achievements: 70, hours: [15, 30], difficulty: 5, priceBRL: 89, note: 'Parece quase pronto, mas as pendências são do Versus (DLC online): 30 vitórias em três modos. Só sai com boost combinado.', flags: ['online'] },
        { appid: '952070', title: 'RESIDENT EVIL RESISTANCE', year: 2020, achievements: 51, hours: [60, 100], difficulty: 5, priceBRL: 259, note: 'Assimétrico 1v4 com fila pequena; Mastermind e nível de sobrevivente pedem dezenas de partidas.', flags: ['online'] },
        { appid: '390340', title: 'Umbrella Corps', year: 2016, achievements: 41, hours: [40, 80], difficulty: 5, priceBRL: 89, note: 'Shooter competitivo com lobby quase vazio; as conquistas online só saem combinando partidas.', flags: ['online'] },
      ],
    },
  ],
  outOfScope: [
    { appid: '4249100', title: 'Resident Evil (1996)', reason: 'Relançamento clássico sem conquistas na Steam.' },
    { appid: '4249110', title: 'Resident Evil 2 (1998)', reason: 'Relançamento clássico sem conquistas na Steam.' },
    { appid: '4249120', title: 'Resident Evil 3 Nemesis (1999)', reason: 'Relançamento clássico sem conquistas na Steam.' },
    { appid: '1236300', title: 'Resident Evil Re:Verse', reason: 'Fora de venda na Steam.' },
    { appid: '4824610', title: 'Resident Evil Veronica', reason: 'Remake previsto para 2027.' },
  ],
};

export const SAGAS: Saga[] = [FINAL_FANTASY, RESIDENT_EVIL];

export function steamStoreUrl(appid: string) {
  return `https://store.steampowered.com/app/${appid}/`;
}

export function steamPortraitUrls(appid: string) {
  return [
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
  ];
}
