export const rankingsPtBR = {
  lists: {
    finish: {
      label: 'Fechar agora',
      short: 'Agora',
      description: 'Jogos que estão na boca do gol: poucas conquistas restantes e nenhuma trava extrema.',
    },
    quick: {
      label: 'Rápidos',
      short: 'Rápidos',
      description: 'Jogos iniciados ou não que viram mais uma conclusão sem sequestrar o mês.',
    },
    grind: {
      label: 'Projetos longos',
      short: 'Longos',
      description: 'Muita coisa pela frente e dezenas de horas estimadas, mas viável de terminar.',
    },
    demanding: {
      label: 'Exigentes',
      short: 'Exigentes',
      description: 'Conquistas restantes com raridade muito baixa: pedem skill, sorte ou uma relação séria com o jogo.',
    },
    essentials: {
      label: 'Essenciais',
      short: 'Essenciais',
      description: 'Curadoria da comunidade, vinda dos packs em community/ no repositório.',
    },
  },
  /** Templates for the `ReasonCode` values produced by the rankings engine. */
  reasons: {
    remaining: {
      one: '{count} conquista restante',
      other: '{count} conquistas restantes',
    },
    rarest: 'A mais rara: {percent}% dos jogadores',
    near: '{percent}% concluído',
    long: '~{hours}h de projeto',
    short: '~{hours}h para fechar',
    ultraRare: {
      one: '{count} conquista abaixo de 1%',
      other: '{count} conquistas abaixo de 1%',
    },
    notStarted: 'Ainda não iniciado',
  },
  page: {
    eyebrow: 'Automáticos e curados',
    title: 'Rankings',
    description: 'Cinco listas para decidir o próximo jogo: quatro calculadas com as suas conquistas e uma curadoria da comunidade.',
    communityLink: 'Comunidade',
    tabsLabel: 'Listas de ranking',
    games: { one: 'jogo na biblioteca', other: 'jogos na biblioteca' },
    eligible: { one: 'entra nas listas automáticas', other: 'entram nas listas automáticas' },
  },
  columns: { rank: 'Nº', game: 'Jogo', platform: 'Plataforma', situation: 'Sua situação', estimate: 'Estimativa' },
  estimate: { single: '~{hours} h', range: '~{min}–{max} h' },
  situation: { platinum: 'Platina', perfect: '100%', notStarted: 'Não iniciado', outOfLibrary: 'Fora da biblioteca' },
  myNote: 'sua nota',
  recent: {
    platinumsTitle: 'Últimas platinas',
    platinumsSubtitle: 'PSN',
    perfectsTitle: 'Últimos 100%',
    perfectsSubtitle: 'Steam e RetroAchievements',
    empty: 'Nenhuma conclusão registrada ainda.',
  },
  auto: {
    games: { one: 'jogo', other: 'jogos' },
    emptyTitle: 'Nenhum jogo se encaixa por enquanto',
    emptyBody: 'Esta lista só mostra jogos com conquistas carregadas que ainda não foram concluídos. Atualize de novo depois de jogar.',
  },
  curated: {
    youHave: 'Você tem {owned} de {total}',
    completed: { one: '{count} concluído', other: '{count} concluídos' },
    storeLink: 'Abre a loja da Steam',
    unpublishedTitle: 'Ranking não publicado',
    unpublishedBody: 'O ranking Essenciais vem dos packs em `community/`, no repositório.',
    communityLink: 'Ver a comunidade',
    errorTitle: 'Não foi possível carregar o ranking',
  },
  noGames: {
    title: 'Nenhum jogo carregado',
    body: 'Conecte uma plataforma e atualize a biblioteca: as listas automáticas são calculadas a partir das suas conquistas.',
    connect: 'Conectar plataformas',
  },
  error: { title: 'Não foi possível carregar os rankings', retry: 'Tentar de novo' },
  errors: { load: 'Falha ao carregar os rankings', curated: 'Falha ao carregar o ranking' },
};
