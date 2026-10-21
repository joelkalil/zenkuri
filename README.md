<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/wordmark.svg">
    <source media="(prefers-color-scheme: light)" srcset="public/brand/wordmark-claro.svg">
    <img src="public/brand/wordmark-claro.svg" alt="Zenkuri" height="72">
  </picture>
</p>

<p align="center">
  <strong>Seu guia de estratégia para zerar 100% — Steam, PlayStation e RetroAchievements.</strong>
</p>

<p align="center">
  <sub>全クリ · zen-kuri</sub>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React_19-1A1817?style=flat-square&logo=react&logoColor=E5533A">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite_8-1A1817?style=flat-square&logo=vite&logoColor=E5533A">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-1A1817?style=flat-square&logo=typescript&logoColor=E5533A">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_4-1A1817?style=flat-square&logo=tailwindcss&logoColor=E5533A">
  <img alt="Express 5" src="https://img.shields.io/badge/Express_5-1A1817?style=flat-square&logo=express&logoColor=E5533A">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-1A1817?style=flat-square&logo=sqlite&logoColor=E5533A">
</p>

<p align="center">
  <img src="docs/screenshots/hoje.png" alt="Tela Hoje: jogo fixado, próximos troféus mais fáceis e fase atual do plano" width="100%">
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/hall.png" alt="Hall da Platina: parede de carimbos com as conclusões datadas"><br><sub>Hall da Platina</sub></td>
    <td width="50%"><img src="docs/screenshots/jogo.png" alt="Página de um jogo com checklist de troféus, ficha, notas e guia"><br><sub>Jogo: checklist, notas e guia</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/plano.png" alt="Plano: linha do ano dividida em fases"><br><sub>Plano do ano</sub></td>
    <td width="50%"><img src="docs/screenshots/biblioteca-papel.png" alt="Biblioteca no tema claro Papel"><br><sub>Tema Papel</sub></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="docs/screenshots/hoje-mobile.png" alt="Tela Hoje em um celular" width="260"><br><sub>Hoje no celular</sub></td>
  </tr>
</table>

## 01 · O que é

**Zenkuri** (全クリ) vem de 全クリア, gíria japonesa de gamer para "100% concluído". É um planejador pessoal de platinas e 100% que reúne **Steam**, **PlayStation Network** e **RetroAchievements** em um só lugar, para decidir o que jogar a seguir, acompanhar o que já foi zerado e guardar o contexto de cada jogo (notas, guia, esforço).

Foi pensado para uso privado, entre trabalho, estudos e sessões curtas de jogo: cada tela existe para reduzir o esforço de escolher a próxima conquista. Veja [`PRODUCT.md`](PRODUCT.md).

### Identidade

Hanko + guia de estratégia: selo vermelhão com 全, neutros de tinta sumi e papel, diagramação editorial e conclusões registradas como carimbos datados.

| Marca | Significado |
| :---: | --- |
| <img src="public/brand/mark.svg" alt="Selo vermelhão com o kanji 全" width="48"> | O selo (hanko) com 全, "completo". Assinatura do projeto. |
| <img src="public/brand/stamp-platina.svg" alt="Carimbo de platina" width="64"> | Carimbo de **platina** conquistada. |
| <img src="public/brand/stamp-100.svg" alt="Carimbo de 100%" width="64"> | Carimbo de **100%** concluído. |

## 02 · Recursos

| Página | O que faz |
| --- | --- |
| **Hoje** | O que jogar agora: jogo fixado, próximos 3 troféus mais fáceis, fase do plano, "quase lá" e conquistas recentes. |
| **Plano** | Linha do ano organizada em fases. |
| **Biblioteca** | Visões em lista, grade e coleções; filtros guardados na URL; rolagem infinita. |
| **Sagas** | Jogos agrupados por saga. |
| **Jogo** | Checklist de troféus, ficha, notas, link de guia e estimativa de esforço. |
| **Conquistas** | **Hall da Platina** (parede de carimbos), **Rankings** e **Almanaque**. |

Também inclui:

- Níveis por conquistas.
- Temas **Zenkuri** (escuro) e **Papel** (claro).
- Cache local de artes com catálogo de origem (veja [06](#06--artes-e-cache-local)).

## 03 · Começando

Requisitos: Node.js e npm. O projeto foi desenvolvido com Node 26 e npm 11; o `package.json` não define `engines`.

```bash
git clone https://github.com/joelkalil/zenkuri.git
cd zenkuri
npm install
cp .env.example .env   # preencha as credenciais (seção 04)
npm run dev
```

- Web (Vite): <http://localhost:5173>
- API (Express): <http://localhost:4343>

> O npm 11+ pode bloquear scripts de instalação. O `package.json` já traz um bloco `allowScripts` aprovando `better-sqlite3`, `esbuild` e `fsevents`; o `better-sqlite3` precisa dele para compilar o binding nativo do SQLite.

**Login.** O app tem autenticação própria, com telas de login e configuração inicial. Ao migrar um banco antigo (de usuário único), o histórico é movido para um usuário legado, definido por `ZENKURI_LEGACY_USER` e `ZENKURI_LEGACY_PASSWORD`. Defina esses valores no `.env` antes da migração e troque a senha após o primeiro acesso (detalhes em `server/db.ts`).

## 04 · Configuração

Copie `.env.example` para `.env`. **Nunca faça commit do `.env`** (ele já está no `.gitignore`). As credenciais são de uma conta de serviço, nunca de usuários do app.

| Variável | Obrigatória | Descrição |
| --- | :---: | --- |
| `ZENKURI_STEAM_API_KEY` | sim | Chave da Steam Web API. |
| `ZENKURI_PSN_NPSSO` | sim | Token `npsso` da PSN (veja abaixo). |
| `ZENKURI_RA_USERNAME` | sim | Usuário do RetroAchievements. |
| `ZENKURI_RA_API_KEY` | sim | Chave da API do RetroAchievements. |
| `ZENKURI_API_PORT` | não | Porta da API (padrão `4343`). |
| `ZENKURI_DB_PATH` | não | Caminho alternativo do banco SQLite. |
| `ZENKURI_LEGACY_USER` / `ZENKURI_LEGACY_PASSWORD` | não | Usuário legado usado na migração de bancos antigos. |

**Como obter o `npsso`:** entre em [playstation.com](https://www.playstation.com) com a conta, depois abra <https://ca.account.sony.com/api/v1/ssocookie> e copie o valor de `npsso`. Ele expira periodicamente; quando a sincronização da PSN falhar, gere outro.

Os dados ficam em `data/zenkuri.sqlite` (ignorado pelo git).

## 05 · Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API e web juntos. |
| `npm run dev:web` | Só o frontend (Vite, `:5173`). |
| `npm run dev:api` | Só a API (`tsx watch`, `:4343`). |
| `npm run build` | Checagem de tipos (`tsc -b`) e build do Vite. |
| `npm run preview` | Serve o build de produção localmente. |
| `npm run lint` | ESLint. |
| `npm run test:level` | Testes da matemática de níveis. |
| `npm run media:backfill` | Completa artes pendentes no cache (aceita `-- --dry-run`). |

## 06 · Artes e cache local

As imagens são espelhadas em `data/media/` (ignorado pelo git), em pastas por tipo: `covers`, `portraits`, `heroes`, `icons` e `achievements`. O arquivo `data/media/catalog.json` registra a origem e a procedência de cada imagem.

- **Steam:** para apps mais novos, há fallback para os assets da loja.
- **PSN:** a arte oficial é buscada durante a sincronização (apenas PS4/PS5).
- **Manual:** coloque uma imagem com o mesmo nome-base na pasta do slot. Ela passa a valer e nunca é sobrescrita.
- **Backfill:** `npm run media:backfill` pede ao servidor em execução cada arte pendente (placeholders e slots da PSN que podem ser melhorados). Use `npm run media:backfill -- --dry-run` para só listar.

## 07 · Estrutura

```
zenkuri/
├── src/                 # frontend (React + Vite)
│   ├── pages/           # Hoje, Plano, Biblioteca, Jogo, Hall, Rankings, Almanaque, Sagas, Login...
│   ├── components/      # TopNav, TabBar, Stamp, LibraryCard, plan/...
│   ├── context/         # autenticação, tema, dados da Steam
│   ├── hooks/           # rolagem infinita, media query, próximo mais fácil...
│   ├── lib/             # cliente da API, cache, plataformas, datas do plano
│   ├── data/            # planos, rankings e sagas curados
│   └── styles/          # estilos da identidade
├── server/              # API Express 5 + better-sqlite3
│   ├── providers/       # Steam, PSN e RetroAchievements
│   ├── scripts/         # media:backfill
│   └── ...              # banco, auth, níveis, mídia e catálogo
├── public/brand/        # wordmark, selo e carimbos
├── docs/screenshots/    # capturas usadas neste README
├── data/                # banco SQLite e cache de mídia (ignorado)
├── DESIGN.md
└── PRODUCT.md
```

**Stack:** React 19, Vite 8, TypeScript, Tailwind v4 e react-router 7 no frontend; Express 5, better-sqlite3 e tsx na API; integrações via `psn-api`, `@retroachievements/api` e Steam Web API. Fontes: Zen Kaku Gothic New, Inter e JetBrains Mono.

## 08 · Design

- [`DESIGN.md`](DESIGN.md): sistema visual (cores, tipografia, componentes).
- [`PRODUCT.md`](PRODUCT.md): propósito, usuários, personalidade e princípios.

---

<sub>Projeto pessoal, sem licença de uso definida.</sub>
