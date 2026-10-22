// Messages for the errors area (pt-BR is the source of truth for key types).
// `api` mirrors the dotted error codes (`auth.invalid_credentials` -> api.auth.invalid_credentials),
// so a code maps to its message with `errors.api.<code>`.
export const errorsPtBR = {
  generic: 'Algo deu errado.',
  api: {
    auth: {
      unauthenticated: 'Sua sessão expirou. Entre novamente.',
      invalid_credentials: 'Usuário ou senha incorretos.',
      invalid_username: 'Nome de usuário inválido. Use de 3 a 24 letras, números, ponto, hífen ou sublinhado.',
      username_taken: 'Este nome de usuário já está em uso.',
      password_too_short: 'A senha é curta demais. Use pelo menos 6 caracteres.',
      current_password_incorrect: 'A senha atual está incorreta.',
      display_name_required: 'Informe um nome de exibição.',
    },
    sync: {
      unsupported_platform: 'Plataforma não suportada.',
      not_configured: 'Esta plataforma ainda não está conectada. Conecte-a em Ajustes.',
      link_not_verified: 'O vínculo desta conta ainda não foi verificado. Confirme o código em Ajustes.',
      identifier_required: 'Informe o identificador da conta.',
      steam_id_required: 'Informe o SteamID64 ou o nome do perfil da Steam.',
      steam_profile_not_found: 'Perfil da Steam não encontrado. Confira o identificador.',
      steam_profile_unreadable: 'Não foi possível ler o perfil da Steam agora. Tente novamente em instantes.',
      steam_profile_private: 'O perfil da Steam é privado. Deixe-o público para continuar.',
      steam_key_rejected: 'A Steam rejeitou a chave de API do servidor. Veja Tutoriais.',
      psn_profile_not_found: 'Perfil da PSN não encontrado. Confira o online ID.',
      ra_user_not_found: 'Usuário do RetroAchievements não encontrado.',
      verification_not_linked: 'Vincule a conta antes de verificar.',
      verification_no_pending_code: 'Não há código de verificação pendente. Vincule a conta de novo.',
      verification_code_not_found: 'O código ainda não apareceu na descrição do perfil. Salve o perfil e tente de novo.',
      steam_service_not_configured: 'O serviço da Steam não está configurado no servidor. Veja Tutoriais.',
      ra_service_not_configured: 'O serviço do RetroAchievements não está configurado no servidor. Veja Tutoriais.',
      psn_service_not_configured: 'O serviço da PSN não está configurado no servidor. Veja Tutoriais.',
      psn_credential_expired: 'A credencial de serviço da PSN expirou. Atualize ZENKURI_PSN_NPSSO no .env e reinicie o servidor. Veja Tutoriais.',
      in_progress: 'Já existe uma atualização em andamento. Aguarde ela terminar.',
    },
    game: {
      not_found: 'Jogo não encontrado.',
    },
    collections: {
      name_required: 'Informe um nome para a coleção.',
    },
    plan: {
      not_found: 'Você ainda não tem um plano.',
      item_not_found: 'Item do plano não encontrado.',
      already_exists: 'Você já tem um plano.',
      slug_taken: 'Já existe uma fase com este identificador.',
      invalid_date_range: 'A data final não pode ser anterior à inicial.',
      entry_requires_hours_and_kind: 'Entradas de fase precisam de horas e de um tipo.',
      phase_id_required: 'Escolha a fase desta entrada.',
      phase_id_not_allowed: 'Só entradas de fase podem ter uma fase.',
      entry_cannot_change_phase: 'Uma entrada não pode mudar de fase.',
    },
    community: {
      publication_not_found: 'Publicação não encontrada.',
    },
    validation: {
      invalid: 'Alguns campos são inválidos.',
    },
    request: {
      invalid_body: 'Não foi possível ler a requisição. Tente novamente.',
      too_large: 'A requisição é grande demais.',
    },
    server: {
      internal: 'Erro interno do servidor. Tente novamente.',
    },
    network: {
      unreachable: 'Não foi possível falar com o servidor. Verifique se ele está rodando.',
    },
    response: {
      invalid: 'O servidor respondeu algo inesperado.',
    },
  },
  issue: {
    required: 'Campo obrigatório',
    invalid_type: 'Tipo de valor inválido',
    invalid_value: 'Valor inválido',
    invalid_format: 'Formato inválido',
    invalid_range: 'Valor fora do intervalo permitido',
    too_short: 'Valor curto demais',
    too_long: 'Valor longo demais',
    unknown_field: 'Campo desconhecido',
    duplicate: 'Valor duplicado',
    conflict: 'Valor em conflito com outro',
    empty: 'Não pode ficar vazio',
  },
  context: {
    loadGamesFailed: 'Não foi possível carregar os jogos.',
    syncFailed: 'Não foi possível atualizar as plataformas.',
    syncUnknownFailure: 'falha desconhecida',
    syncPlatformFailure: '{platform}: {reason}',
    syncJoiner: ' · ',
  },
};
