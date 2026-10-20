# Zenkuri — Launcher

Direção pedida pelo usuário em 16 de outubro de 2026: a linguagem do novo Epic Games Launcher (https://launcher.epicgames.com), aplicada como mudança completa de estrutura e componentes — não apenas de cores. Substitui a "Galeria contínua" (out/2026). Cálculos, integrações, dados, filtros e ações existentes são preservados. Referências salvas em `.artefacts/designs/epic-launcher-ref/`.

## Overview

O app se comporta como um launcher de jogos: uma moldura fina (barra superior e barra de status) envolve um painel de conteúdo arredondado. Capas e arte de fundo são o conteúdo principal; a interface é neutra, plana e com um único acento.

## Colors

Tema padrão `epic` ("Launcher"): neutros quase-pretos sem matiz — canvas #101014, moldura #18181c, superfícies #1a1a1f, divisores #2a2a30; texto #f4f4f5 / #a0a0a7 / #8b8b92. Acento único azul Epic #26bbff, usado com texto escuro (#06121b) em botões primários e badges (contraste 9:1). A variante escura #0a78c2 (`violet-600`) aceita texto branco (AA) nos componentes legados. Verde indica 100%; ouro mantém o significado de troféus. Os temas antigos (Zenkuri escuro/claro, Steam, PSNProfiles) continuam disponíveis em Aparência e funcionam com a nova estrutura. Na primeira abertura após o redesign o app troca uma única vez para `epic` (`zenkuri-theme-version = 2`); depois disso a escolha do usuário é respeitada.

## Typography

Inter Variable (`@fontsource-variable/inter`), fallback Segoe UI/system-ui. Pesos 500–750, títulos em caixa normal com tracking levemente negativo, números tabulares.

## Layout

- **Top bar** (56px): logo, voltar/avançar, sete destinos em pílula (ativo = fundo `gray-800`), nível e perfil à direita. Abaixo de 1100px os destinos vão para uma segunda linha com rolagem horizontal.
- **Painel de conteúdo**: margem de 8px, cantos de 12px, borda de 1px; ocupa toda a largura no celular.
- **Barra de status** (40px): Recentes (jogos das últimas 2 semanas, em popover) · Sincronização · estado das plataformas.
- Páginas não repetem o título visualmente quando a pílula ativa já diz onde se está (Painel, Biblioteca usam `h1` só para leitores de tela).

## Components

- **Abas internas**: texto com sublinhado curto no acento (`.subtab`).
- **Biblioteca**: abas de status à esquerda; busca em pílula, alternância grade/lista/coleções e "Filtrar e ordenar" (popover com ordenação e plataforma, badge de ajustes ativos e "Limpar tudo") à direita. Filtros ativos aparecem como chips removíveis. Grade de 2 a 8 colunas; capa 2:3 com barra de progresso fina sobre a base da arte, selos de Platina/100%/Abandonado no canto, nome e uma linha de metadados abaixo.
- **Coleções**: cartões com título, contagem e média, e quatro capas em fileira; cartão tracejado "Nova coleção".
- **Painel**: destaque estilo vitrine (arte grande + fila lateral de fixados e "quase lá", troca por clique, sem rotação automática), blocos de números, prateleira "Quase lá" com setas, listas de recentes e prioridades, relíquias.
- **Página do jogo**: arte larga com capa, título e progresso; barra de ações (fixar = primário, backlog, abandonado, guia) e fatos (conclusão, conquistas, por tipo, tempo); abas Troféus/Estatísticas/Atividade; tabela "Detalhes" (plataforma, esforço, mês da platina, coleção, guia) e notas na lateral.
- **Rankings**: abas por lista; top 3 em cartões largos com a arte do jogo, posição grande e nota da curadoria; posições 4+ em lista numerada; últimas platinas e 100% na lateral.
- **Sagas**: abas entre sagas; banner da franquia com progresso e "Continuar" no próximo jogo; blocos de números; fases como listas.
- **Plano**: cabeçalho com blocos (fase atual, etapas, média Steam, próximo marco); faixa do ano numa superfície; fase escolhida em listas; fila, últimos 14 dias e agenda na lateral.
- **Hall da Platina**: cartazes no mesmo formato de capa da biblioteca, com selo, número de ordem e data; abas Todas/Platinas/100% com contagem.
- **Almanaque**: cabeçalho padrão com ano e impressão, blocos de números, mapa de calor numa superfície.
- **Ajustes**: menu vertical à esquerda (como as configurações do launcher) com descrição de cada seção; vira faixa horizontal abaixo de 1100px.
- **Login e configuração inicial**: cartão central sobre fundo escuro com brilho sutil do acento; abas sublinhadas; botão primário largo.

## Motion

160–240ms para seleção e controles; capas aproximam 3% no hover/foco; arte do destaque entra com fade curto. Nenhuma animação contínua. `prefers-reduced-motion` respeitado.

## Do's and Don'ts

- Manter cálculos e funcionalidades atuais.
- Um único acento por tema; nada de gradientes decorativos ou neon.
- Usar `.page`/`.page-head`, `.btn`, `.accent-fill`, `.subtab`, `.segmented`, `.surface`, `.list-surface`, `.stat-tile`, `.feature-card` (em `src/gallery.css`, camada `components` do Tailwind — utilitários continuam podendo sobrescrever) antes de criar estilos novos.
- Botões primários usam o acento com texto escuro (`.btn-primary`/`.accent-fill`), nunca `bg-violet-600 text-white`.
- Validar desktop, tablet, celular, teclado e contraste ao implementar.
