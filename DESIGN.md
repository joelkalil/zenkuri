# Zenkuri — Hanko + Guia de estratégia

Direção aprovada em 20 de outubro de 2026 (A + C, "Hanko + Guia de estratégia"). Substitui por completo o "Launcher" de 16 de outubro de 2026 (moldura de launcher, azul Epic, barra de status). Cálculos, integrações, dados, filtros e ações existentes são preservados. Fonte de verdade: o código (`src/index.css`, `src/gallery.css`, `src/styles/`); o brief e os arquivos de marca ficam em `.artefacts/designs/2026-10-20-brand/` (`brief.md`, `assets.md`, `wireframes.md`).

## Overview

**Zenkuri = 全クリ (zenkuri)**, gíria gamer japonesa para "100% completo". O app é o registro pessoal dessas conclusões, e a identidade vem de dois objetos japoneses:

- **Hanko (A):** o selo de tinta vermelhão (朱). Cada platina ou 100% é um carimbo datado, como num caderno de registro.
- **Guia de estratégia (C):** revista impressa. Hierarquia tipográfica forte, seções numeradas, filetes em vez de caixas, tabelas densas, numerais tabulares.

Princípios: um único acento (vermelhão); papel e tinta (neutros quentes: sumi no escuro, papel no claro); plano, sem gradiente, neon ou brilho — a arte dos jogos é a única decoração; planejamento primeiro, com informação densa e alinhada.

**Estrutura.** Sem moldura de launcher: conteúdo direto sobre o canvas, separado por filetes. A navegação tem 3 grupos (`src/components/nav.ts`), com subnav por grupo; `/game/*` pertence à Biblioteca e `/settings` fica no menu de perfil.

| Grupo | Destinos |
|---|---|
| Hoje | Hoje (`/`), Plano |
| Biblioteca | Jogos, Coleções, Sagas |
| Conquistas | Hall, Rankings, Almanaque |

Barra superior de 56px (marca, 3 grupos em caixa-alta com sublinhado de acento no ativo, `SyncButton`, chip de nível, `ProfileMenu`) e subnav de 40px com sublinhado no item ativo. O `ProfileMenu` reúne perfil, plataformas, Ajustes e aparência. Abaixo de 768px a navegação vira `TabBar` inferior e o perfil abre como sheet.

## Colors

Dois temas em `src/index.css` (`data-theme`), ambos remapeando `--color-gray-*` e `--color-violet-*` (= acento vermelhão). Nos temas claros a escala gray é **invertida** (gray-50 = tinta mais forte, gray-950 = canvas). Padrão: `zenkuri` (escuro, "Sumi quente e vermilhão"); alternativo: `zenkuri-claro` ("Papel").

| Papel | Token | `zenkuri` | `zenkuri-claro` |
|---|---|---|---|
| Canvas | gray-950 | #121110 | #F3EEE4 |
| Superfície | gray-900 | #1A1817 | #FBF8F2 |
| Elevado / hover de linha | gray-850 | #221F1D | #EAE3D6 |
| Filete | gray-800 | #2E2A27 | #DCD3C5 |
| Filete forte | gray-700 | #4A4540 | #C3B9A8 |
| Faint / borda de controle | gray-600 | #7D766C | #7A7266 |
| Muted | gray-500 | #8F887D | #686157 |
| Texto secundário | gray-300 | #C4BCB0 | #433E37 |
| Texto principal | gray-100 | #EDE7DD | #1C1A17 |
| Acento (preenchimento) | violet-500 | #E5533A | #B93A23 |
| Acento (link, foco) | violet-400 | #EE6E56 | #B93A23 |
| Hover do primário | `--accent-hover` | #EE6E56 | #A23220 |
| Tinta sobre acento | `--zk-accent-ink` | #160B08 | #FFFFFF |

Semânticos (`--zk-*`, expostos no Tailwind como `zk-bronze`, `zk-silver`, `zk-gold`, `zk-platinum`, `zk-complete`, `zk-danger`, `zk-accent-ink`):

| Token | Escuro | Claro | Significado |
|---|---|---|---|
| `--zk-bronze` | #CD8A57 | #8F5424 | troféu de bronze |
| `--zk-silver` | #B8BEC6 | #5C646E | troféu de prata |
| `--zk-gold` | #E3B341 | #7D5A0A | troféu de ouro |
| `--zk-platinum` | #9CC4E8 | #2F6592 | platina (badge `data-tone="platinum"`) |
| `--zk-complete` | #5FB98A | #1F6B44 | 100% completo (jade) |
| `--zk-danger` | #F2766B | #B3261E | erro / destrutivo |

Regras: o vermelhão é marca e ação, não estado; o **selo de Platina** usa o vermelhão (violet-500) e o **selo de 100%** usa jade (`--zk-complete`); o badge de texto "Platina" usa o azul frio `--zk-platinum`. Perigo vem sempre com texto ou ícone, nunca só cor. Tinta escura sobre o acento no escuro (branco dá só 3,73:1); no claro, branco. Bordas de controles usam gray-600 (≥3:1); gray-700/800 são só filetes decorativos. `ThemeContext` oferece só esses 2 temas; versão de migração `3` (`zenkuri-theme-version`): na primeira carga `light` vira `zenkuri-claro` e qualquer valor antigo vira `zenkuri`; depois a escolha é respeitada.

## Typography

| Função | Família | Pacote npm |
|---|---|---|
| Display, títulos, números grandes | Zen Kaku Gothic New (500/700/900, `latin`) | `@fontsource/zen-kaku-gothic-new` |
| Texto de UI e números inline | Inter Variable | `@fontsource-variable/inter` |
| Colunas numéricas de tabela, números de seção, datas de estampa | JetBrains Mono (400/500) | `@fontsource/jetbrains-mono` |

Tokens `--font-display`, `--font-sans`, `--font-mono` em `@theme`; `h1–h3` usam display. O `body` já aplica `tabular-nums`.

**Quando usar mono:** apenas (1) colunas numéricas de tabelas, (2) números de seção ("01") e (3) datas dentro de estampas. Números inline em frases, rótulos e metadados usam Inter com `tabular-nums`, não mono. Use `.num` só nesses casos. Números grandes de herói: Zen Kaku 900.

Escala: display 48/900; H1 32/700; H2 22/700; H3 16/700 (tracking -0,02 a 0); corpo 14 Inter; small 12,5; micro 11/600, +0,08em, caixa-alta (`.micro`, `.col-head`). `.lede` (15px, muted) é a linha editorial. Sem itálico decorativo nem caixa-alta longa.

## Layout

- **Página:** `.page` (máx. 1480px, `.page-narrow` 1180px; páginas podem definir o próprio máximo, ex.: Hoje 1280px), `--page-gutter: clamp(1rem, 2.6vw, 2.5rem)`, cabeçalho `.page-head`. O app rola dentro de `.app-content`.
- **Seções numeradas** (`SectionHead`): "01 · Título" com número em mono, filete acima; `.rule` (1px gray-800) separa; `.rule-strong` (2px gray-100) só como régua de abertura no topo da página.
- **Raios:** 4px em controles e capas (`--radius-cover`), 8px em painéis, 2px em selos/badges. Sem cartões aninhados; superfície (`.surface`, gray-900) só para popovers, modais, inputs e o painel fixo de detalhe.
- **Breakpoints:** 1280, 1100 e 768px. Abaixo de 768px a `TabBar` substitui a navegação superior; tabelas viram listas verticais ou acordeões.
- **Estatísticas:** uma linha editorial (`.lede` com números) ou ficha de 2 colunas separada por filetes.
- **Páginas:** cada uma tem o CSS em `src/styles/<página>.css` (`hoje`, `biblioteca`, `jogo`, `hall`, `plano`, `rankings`, `sagas`, `almanaque`, `ajustes`, `login`); primitivos globais em `src/gallery.css`; tokens em `src/index.css`. Estilos de página não redefinem primitivos.

## Components

- **Primitivos (`src/gallery.css`):** `.btn` (+`.btn-sm`) com variantes `.btn-primary`/`.accent-fill`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`; `.badge[data-tone]` (`platinum`, `complete`, `gold`, `danger`, `accent`; contorno 1px, sem fundo); `.rule`, `.rule-strong`; `.micro`, `.num`, `.lede`; `.col-head`; `.row`; `.page`, `.page-head`; `.subtab`; `.segmented`; `.surface`. Botão primário: preenchimento violet-500 com `--zk-accent-ink`, um por região. `.stat-tile`/`.stat-strip` estão **deprecados** (mantidos só até a migração).
- **Stamp** (`src/components/Stamp.tsx`): `<Stamp kind="platina" | "100" date size={24|48|96} seed />`. Usa os SVGs `/brand/stamp-platina.svg` (vermelhão) e `/brand/stamp-100.svg` (jade) com data em mono (`dd.mm.aa` em 48; `dd.mm.aaaa` em 96; sem data em 24). Rotação determinística de -4° a +4° via hash de `seed` (id do jogo), nunca animada, 0° no tamanho 24. `role="img"` com `aria-label`; o estado também aparece em texto na linha. Sem textura nem brilho.
- **SectionHead:** `<SectionHead number="01" title sub action />`.
- **Logo/marca** (`Logo.tsx`, `public/brand/`): selo quadrado com 全 em Zen Kaku 900. Arquivos: `mark.svg`, `mark-16.svg`, `mark-paper.svg`, `mark-mono.svg`, `mark-192.png`, `mark-512.png`, `wordmark.svg`, `wordmark-escuro.svg`, `wordmark-claro.svg`, `stamp-platina.svg`, `stamp-100.svg`. Selo `#E5533A` + glifo `#160B08` no escuro; `#B93A23` + branco no claro. Mínimo 16px. Nunca recolorir, girar mais de 4°, aplicar sombra, gradiente ou textura.
- **Hoje (`/`):** 01 Agora, 02 Plano, 03 Quase lá, 04 Recentes; linha editorial de números; um único controle segmentado de plataforma.
- **Jogo:** cabeçalho compacto; checklist de troféus acima da dobra; "Ficha" fixa (sticky) na lateral; acordeão no celular; breadcrumb via `state.from`.
- **Biblioteca:** visão, status, plataforma e layout vêm de `searchParams` da URL; lista é o padrão; grade com capa 2:3, progresso em filete de 3px na base (jade em 100%).
- **Hall:** parede de selos por ano; `?tipo=platina|100`.
- **Plano:** linha editorial; `YearStrip` com códigos F1–F6 e tabela de legenda; lista vertical no celular.
- **Rankings:** top 3 em destaque e tabela numerada com "Sua situação". **Sagas:** seções de fases numeradas.
- **Almanaque:** frase-resumo, mapa de calor; na impressão força a paleta clara.
- **Ajustes:** menu vertical só de texto; 2 temas. **Login/Setup:** cartão central com a marca e o nome.
- **Estados:** vazios em texto (título + frase + ação primária); carregando com linhas-esqueleto gray-850 sem shimmer; erro em `--zk-danger` com causa e "Tentar de novo". Ícones só quando acrescentam significado (plataforma, ordenar, fechar, link externo), 16px, traço 1,5px, `currentColor`.
- **Texto:** pt-BR, direto, infinitivo em ações; nível como "Nível 45 · Mestre"; datas `20 out 2026` no texto e `20.10.2026` em mono; decimal com vírgula. 全クリ só na marca e no Sobre, nunca como rótulo de navegação.

## Motion

Transições de 140ms `ease-out` (`--motion-fast`, `--motion-ease`) só em cor, fundo, borda, opacidade e `transform` leve (≤2px); sublinhado de navegação anima por `scaleX`. Sem animação contínua (pulso, shimmer, parallax, glow). A estampa pode aparecer uma vez ao concluir um jogo (opacidade e escala 1,04→1, 160ms). `prefers-reduced-motion` respeitado.

## Do's and Don'ts

- Manter cálculos e funcionalidades atuais.
- **Um único acento** (vermelhão); cor extra só para troféus e estados.
- **Sem gradientes, neon ou glow**, nem em fundos de login, placeholders ou barras.
- **Sem fileiras de cartões coloridos idênticos de estatística** (ícone + número + "x% do total"): use linha editorial ou ficha. Não exibir zeros sem motivo.
- Mono só em colunas numéricas de tabela, números de seção e datas de estampa; números inline usam Inter `tabular-nums`.
- **Usar primitivos existentes antes de criar estilos:** `.btn` (+variantes), `.accent-fill`, `.badge[data-tone]`, `.rule`/`.rule-strong`, `.micro`, `.num`, `.lede`, `.col-head`, `.row`, `.page`/`.page-head`, `.subtab`, `.segmented`, `.surface`, `SectionHead`, `Stamp`. Novos estilos vão em `src/styles/<página>.css`.
- Primário nunca com `bg-violet-600 text-white`; usar `.btn-primary`/`.accent-fill`. Não usar `.stat-tile`/`.stat-strip`.
- Badges e estados sempre com texto, nunca só cor. Nunca remover o anel de foco (`outline: 2px` violet-400).
- **Validar ao implementar:** desktop (≥1280), tablet (768–1099), celular (<768); navegação por teclado (foco visível, ordem, skip-link); contraste (texto ≥4,5:1, controles ≥3:1); os **dois temas** (`zenkuri` e `zenkuri-claro`); impressão do Almanaque.
