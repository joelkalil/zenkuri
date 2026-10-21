/*
 * Tutorials copy. Text between backticks renders as inline `code`.
 * Steps, privacy notes and errors are numbered objects because message
 * trees do not support arrays; the page lists the keys it renders.
 */
export const tutorialsPtBR = {
  page: {
    title: 'Tutoriais',
    lede: 'Como obter as chaves e os identificadores que o Zenkuri precisa para ler suas conquistas da Steam, da PlayStation Network e do RetroAchievements.',
  },
  labels: {
    purpose: 'Para que serve',
    steps: 'Passo a passo',
    where: 'Onde colocar o valor',
    privacy: 'Privacidade e segurança',
    errors: 'Erros comuns',
    colValue: 'Valor',
    colWho: 'Quem define',
    colWhere: 'Onde',
    scopeServer: 'Quem executa a instância',
    scopeUser: 'Cada usuário',
    envFile: 'Arquivo `.env`',
    settingsPath: 'Ajustes > Conexões',
    field: 'Campo:',
    openSettings: 'Abrir Ajustes',
    problem: 'Sintoma',
    fix: 'Solução',
    toolbarLabel: 'Tutoriais disponíveis',
    external: '(abre em nova aba)',
  },
  overview: {
    title: 'Visão geral',
    serverTitle: 'Chaves do servidor',
    serverBody: 'Ficam no arquivo `.env` e são definidas por quem executa a instância do Zenkuri. Só valem depois de reiniciar o servidor.',
    userTitle: 'Identificadores do usuário',
    userBody: 'SteamID64, Online ID da PSN e usuário do RetroAchievements são informados por cada pessoa em Ajustes > Conexões. São dados públicos do perfil, nunca senhas.',
    indexTitle: 'Escolha a plataforma',
  },
  values: {
    steamKey: 'Web API key da Steam',
    steamId: 'SteamID64 ou URL do perfil',
    npsso: 'Token NPSSO',
    onlineId: 'Online ID (usuário PSN)',
    raKey: 'Web API Key',
    raServiceUser: 'Usuário dono da chave',
    raUser: 'Nome de usuário',
  },
  steam: {
    purpose: 'Permite ler seu perfil, sua biblioteca e suas conquistas da Steam. O servidor usa uma Web API key; cada pessoa só informa o próprio SteamID64 ou a URL do perfil.',
    serverPart: 'Chave do servidor',
    userPart: 'Seu identificador',
    serverSteps: {
      s1: 'Entre na sua conta Steam e abra a página de registro da chave.',
      s2: 'Em "Domain Name", digite qualquer domínio, por exemplo `localhost`. O Zenkuri não depende desse valor.',
      s3: 'Aceite os termos da Steam Web API e confirme o registro.',
      s4: 'Copie a chave exibida e salve no `.env` como `ZENKURI_STEAM_API_KEY`.',
      s5: 'Reinicie o servidor.',
    },
    userSteps: {
      u1: 'Abra a edição do seu perfil na Steam e veja o campo de URL personalizada, ou copie a URL do perfil na barra do navegador.',
      u2: 'Use o SteamID64 (17 dígitos), a URL `steamcommunity.com/profiles/…` ou a URL personalizada `steamcommunity.com/id/…`.',
      u3: 'Em Ajustes > Conexões, escolha Steam, cole o valor e clique em Vincular.',
    },
    links: {
      apiKey: 'steamcommunity.com/dev/apikey',
      editProfile: 'steamcommunity.com/my/edit',
      privacy: 'steamcommunity.com/my/edit/settings',
    },
    privacy: {
      p1: 'Nunca compartilhe a Web API key. Ela identifica sua conta nas chamadas à Steam: não publique o `.env` nem faça commit dele.',
      p2: 'O perfil e os "Detalhes do jogo" precisam estar Públicos para as conquistas aparecerem.',
      p3: 'O Zenkuri lê só dados públicos e nunca pede sua senha da Steam.',
    },
    errors: {
      e1: {
        problem: 'A biblioteca aparece, mas sem conquistas.',
        fix: 'O perfil ou os "Detalhes do jogo" não estão Públicos. Ajuste a privacidade e sincronize de novo.',
      },
      e2: {
        problem: 'A chave da Steam está inválida ou expirou.',
        fix: 'A chave foi revogada ou a senha da Steam foi trocada. Gere uma chave nova, atualize `ZENKURI_STEAM_API_KEY` no `.env` e reinicie o servidor.',
      },
      e3: {
        problem: 'Perfil não encontrado ao vincular.',
        fix: 'Confira o SteamID64 ou a URL. Para URLs personalizadas, o nome precisa existir de fato.',
      },
      e4: {
        problem: 'O servidor diz que a chave não está configurada.',
        fix: 'A variável `ZENKURI_STEAM_API_KEY` está vazia ou ausente no `.env`, ou o servidor não foi reiniciado depois da mudança.',
      },
    },
  },
  psn: {
    purpose: 'Permite ler seus troféus da PlayStation Network. O servidor usa um token NPSSO de sessão; cada pessoa só informa o próprio Online ID.',
    serverPart: 'Token do servidor',
    userPart: 'Seu identificador',
    serverSteps: {
      s1: 'No navegador, entre na sua conta em playstation.com.',
      s2: 'No mesmo navegador, abra o endereço do ssocookie.',
      s3: 'A página mostra um JSON com o campo `npsso`. Copie os 64 caracteres do valor.',
      s4: 'Salve no `.env` como `ZENKURI_PSN_NPSSO` e reinicie o servidor.',
    },
    userSteps: {
      u1: 'Seu Online ID é o nome de usuário da PSN, o mesmo que aparece no seu perfil e no console.',
      u2: 'Em Ajustes > Conexões, escolha PSN, digite o Online ID e clique em Vincular.',
    },
    links: {
      site: 'playstation.com',
      ssoCookie: 'ca.account.sony.com/api/v1/ssocookie',
    },
    privacy: {
      p1: 'O NPSSO equivale a um token de sessão da sua conta Sony. Nunca compartilhe, não publique o `.env` e não faça commit dele.',
      p2: 'O token expira após cerca de 2 meses. Quando isso acontecer, gere outro seguindo os mesmos passos.',
      p3: 'Para os troféus aparecerem, a privacidade do perfil precisa permitir: Configurações > Privacidade > Jogos | Mídia > troféus.',
    },
    errors: {
      e1: {
        problem: 'A sincronização falha dizendo que a credencial expirou.',
        fix: 'O NPSSO expirou. Gere um token novo, atualize `ZENKURI_PSN_NPSSO` no `.env` e reinicie o servidor.',
      },
      e2: {
        problem: 'Perfil não encontrado ao vincular.',
        fix: 'Confira a grafia exata do Online ID, sem espaços extras.',
      },
      e3: {
        problem: 'O perfil vincula, mas os troféus não aparecem.',
        fix: 'A privacidade dos troféus do perfil não permite a leitura. Ajuste em Privacidade > Jogos | Mídia e sincronize de novo.',
      },
      e4: {
        problem: 'O endereço do ssocookie mostra um erro em vez do `npsso`.',
        fix: 'Você não está logado. Entre em playstation.com no mesmo navegador e abra o endereço de novo.',
      },
    },
  },
  retroachievements: {
    purpose: 'Permite ler suas conquistas retrô. O servidor usa uma Web API Key do RetroAchievements; cada pessoa só informa o próprio nome de usuário.',
    serverPart: 'Chave do servidor',
    userPart: 'Seu identificador',
    serverSteps: {
      s1: 'Entre no RetroAchievements e abra as configurações da conta.',
      s2: 'Na seção "Keys", copie a "Web API Key".',
      s3: 'Salve no `.env` como `ZENKURI_RA_API_KEY` e coloque o usuário da conta dona da chave em `ZENKURI_RA_USERNAME`.',
      s4: 'Reinicie o servidor.',
    },
    userSteps: {
      u1: 'Seu nome de usuário é o nome da conta do RetroAchievements, o mesmo do endereço do seu perfil.',
      u2: 'Em Ajustes > Conexões, escolha RetroAchievements, digite o usuário e clique em Vincular.',
    },
    links: {
      settings: 'retroachievements.org/settings',
    },
    privacy: {
      p1: 'Nunca compartilhe a Web API Key: ela dá acesso à API em nome da sua conta. Se vazar, gere outra nas configurações.',
      p2: 'O Zenkuri lê só dados públicos do perfil e nunca pede sua senha.',
    },
    errors: {
      e1: {
        problem: 'Erro de autenticação ao sincronizar.',
        fix: 'Confira se `ZENKURI_RA_USERNAME` é o dono da chave em `ZENKURI_RA_API_KEY`, sem espaços sobrando, e reinicie o servidor.',
      },
      e2: {
        problem: 'Usuário não encontrado ao vincular.',
        fix: 'Confira a grafia do nome de usuário do perfil.',
      },
      e3: {
        problem: 'O servidor diz que as variáveis não estão configuradas.',
        fix: 'Defina `ZENKURI_RA_USERNAME` e `ZENKURI_RA_API_KEY` no `.env` e reinicie o servidor.',
      },
    },
  },
};
