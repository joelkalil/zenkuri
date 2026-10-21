export const setupPtBR = {
  progressSuffix: 'de {total} conectadas',
  title: 'Bem-vindo ao Zenkuri',
  lede: 'Conecte pelo menos uma plataforma para começar. Informe apenas o identificador público do seu perfil: nenhuma senha, token ou API key é necessária.',
  recommended: 'Recomendado',
  connected: 'Conectado',
  skipped: 'Pulado',
  skip: 'Pular',
  connect: 'Conectar',
  reconnect: 'Reconectar',
  help: 'Precisa de ajuda? Veja os tutoriais',
  backToSetup: 'Voltar à configuração',
  continue: 'Continuar',
  platforms: {
    steam: {
      blurb: 'Importe suas conquistas da Steam.',
      inputLabel: 'SteamID64 ou URL do perfil',
      placeholder: 'ex. 76561198000000000 ou steamcommunity.com/id/voce',
    },
    psn: {
      blurb: 'Importe seus troféus da PlayStation Network.',
      inputLabel: 'Online ID (usuário PSN)',
      placeholder: 'ex. seu_online_id',
    },
    retroachievements: {
      blurb: 'Importe suas conquistas retrô.',
      inputLabel: 'Nome de usuário',
      placeholder: 'Usuário do RetroAchievements',
    },
  },
  dialog: {
    title: 'Conectar {platform}',
    close: 'Fechar',
    publicOnly: 'Só lemos dados públicos do perfil, nada de senhas ou tokens.',
    submit: 'Vincular perfil',
    busy: 'Localizando perfil…',
  },
  errors: {
    identifierRequired: 'Informe o identificador do seu perfil.',
    linkFailed: 'Falha ao vincular a conta.',
  },
};
