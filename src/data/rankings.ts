import type { Platform } from '../types/steam';

export type RankingCategoryId = 'finish' | 'grind' | 'quick' | 'demanding' | 'essential';

export interface RankingEntry {
  platform: Platform;
  externalId: string;
  estimate: string;
  note: string;
}

export interface RankingCategory {
  id: RankingCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  entries: RankingEntry[];
}

/*
  Curadoria manual contra o estado real da biblioteca (atualizada em 2026-07-04).
  Jogos já concluídos (100%/platina) ficam fora das listas acionáveis; um mesmo
  jogo pode aparecer em mais de uma lista quando a leitura muda (ex.: Hollow
  Knight é projeto longo E essencial). As linhas só renderizam se o par
  (platform, externalId) existir na biblioteca sincronizada.
*/
export const RANKING_CATEGORIES: RankingCategory[] = [
  {
    id: 'finish',
    label: 'Fechar agora',
    shortLabel: 'Agora',
    description: 'Jogos que estão na boca do gol ou entregam uma conclusão rápida, sem grind desproporcional.',
    entries: [
      { platform: 'steam', externalId: '1790600', estimate: '3–6h', note: 'Três conquistas restantes e a mais próxima das platinas do momento.' },
      { platform: 'steam', externalId: '2483190', estimate: '8–15h', note: 'Duas pendências; uma delas depende do calendário de temporadas.' },
      { platform: 'steam', externalId: '2567870', estimate: '6–10h', note: 'Metade feita; o resto é execução com uma dupla paciente.' },
      { platform: 'steam', externalId: '2784470', estimate: '12–20h', note: 'Builds variadas resolvem a maior parte do que falta.' },
      { platform: 'steam', externalId: '3527290', estimate: '10–18h', note: 'Boa parte sai naturalmente jogando com o grupo de sempre.' },
      { platform: 'steam', externalId: '3164500', estimate: '10–15h', note: 'Só 13 conquistas no total; o império fecha rápido.' },
      { platform: 'steam', externalId: '743450', estimate: '8–12h', note: 'Runs curtas; finais diferentes acumulam sem esforço.' },
      { platform: 'steam', externalId: '3478650', estimate: '4–6h', note: 'Visual novel com seleção de cena; limpeza tranquila.' },
      { platform: 'steam', externalId: '792100', estimate: '4–6h', note: 'Puzzles diretos, 19 conquistas e nenhuma pegadinha.' },
      { platform: 'steam', externalId: '1569580', estimate: '20–30h', note: 'Apenas 16 conquistas; o quebra-cabeça é o próprio caminho.' },
      { platform: 'psn', externalId: 'NPWR20684_00', estimate: '15–20h', note: 'Platina curta de super-herói, quase toda na história.' },
      { platform: 'psn', externalId: 'NPWR51746_00', estimate: '25–35h', note: 'Recém-começado; platina generosa no ritmo da campanha.' },
      { platform: 'steam', externalId: '1546970', estimate: '18–25h', note: 'Liberty City clássica: 100% direto, sem online.' },
      { platform: 'steam', externalId: '387290', estimate: '12–18h', note: 'Curto e lindo; as runs extras são o único dente.' },
      { platform: 'steam', externalId: '268910', estimate: '18–25h', note: 'Skill pura, mas compacto; cada chefe vencido é progresso real.' },
      { platform: 'retroachievements', externalId: '515', estimate: '20–30h', note: 'Set principal do RA no ritmo de uma run completa de Kanto.' },
      { platform: 'steam', externalId: '638230', estimate: '4–8h', note: 'Curto e contemplativo, com uma conquista de companheiro.' },
      { platform: 'steam', externalId: '414340', estimate: '6–8h', note: 'Uma campanha focada e poucos colecionáveis.' },
      { platform: 'steam', externalId: '1426210', estimate: '12–15h', note: 'Vinte conquistas em coop; rende com parceiro fixo.' },
      { platform: 'steam', externalId: '252410', estimate: '8–10h', note: 'Compacto; uma run eficiente resolve tudo.' },
    ],
  },
  {
    id: 'grind',
    label: 'Reta final com grind',
    shortLabel: 'Grind',
    description: 'O percentual está bonito, mas as últimas conquistas cobram repetição, online ou conteúdo extra.',
    entries: [
      { platform: 'steam', externalId: '675690', estimate: '20–60h', note: 'Uma conquista restante, totalmente baseada em volume.' },
      { platform: 'steam', externalId: '2904000', estimate: '12–25h', note: 'Pendências pedem personagens específicos e sessões em coop.' },
      { platform: 'steam', externalId: '3678970', estimate: '40h+', note: 'Idle sem atalho elegante: deixar rodando e voltar depois.' },
      { platform: 'steam', externalId: '21690', estimate: '15–30h', note: 'As vitórias do modo Versus são a verdadeira barreira.' },
      { platform: 'steam', externalId: '2215430', estimate: '20–35h', note: 'Legends, Raid e New Game+ depois da campanha.' },
      { platform: 'steam', externalId: '1097150', estimate: '20–50h', note: 'Vitórias, qualificações e progressão sazonal.' },
      { platform: 'psn', externalId: 'NPWR22859_00', estimate: '20–35h', note: 'A platina saiu; faltam os extras de Legends para o 100%.' },
      { platform: 'steam', externalId: '3405340', estimate: '30–60h', note: 'Muitas condições específicas e uma dose de RNG.' },
      { platform: 'steam', externalId: '2138720', estimate: '20–40h', note: 'Metas cumulativas de gols, defesas, distância e nível.' },
      { platform: 'steam', externalId: '1811260', estimate: '30–60h', note: 'Objetivos online e de temporada; melhor em doses semanais.' },
      { platform: 'steam', externalId: '960090', estimate: '250h+', note: 'Conquistas diárias, eventos e grind de longuíssimo prazo.' },
      { platform: 'steam', externalId: '1938090', estimate: '50h+', note: '157 conquistas atravessando modos, mapas e temporadas.' },
      { platform: 'steam', externalId: '1599340', estimate: '150h+', note: 'A progressão de MMO domina completamente o cronograma.' },
      { platform: 'steam', externalId: '1172470', estimate: '30–60h', note: 'Conquistas presas a lendas específicas e partidas online.' },
      { platform: 'steam', externalId: '1172620', estimate: '200h+', note: '293 conquistas: é um estilo de vida, não uma meta de mês.' },
      { platform: 'steam', externalId: '1085660', estimate: '60h+', note: 'Raids e atividades em grupo mandam no ritmo.' },
      { platform: 'steam', externalId: '945360', estimate: '20–40h', note: 'Depende de lobby cheio e dos papéis certos caírem.' },
      { platform: 'steam', externalId: '714010', estimate: '40h+', note: 'Cem conquistas de treino cumulativo, sem pressa.' },
      { platform: 'steam', externalId: '844870', estimate: '40h+', note: 'Online de nicho com progressão lenta; jogue por gostar.' },
      { platform: 'steam', externalId: '1278540', estimate: '30–50h', note: '107 conquistas espalhadas por temporadas repetidas.' },
    ],
  },
  {
    id: 'quick',
    label: '100% rápidos',
    shortLabel: 'Rápidos',
    description: 'Jogos não iniciados ou abaixo de 50% que podem virar mais uma conclusão sem sequestrar o mês.',
    entries: [
      { platform: 'steam', externalId: '1454970', estimate: '10–12h', note: 'Narrativo com seleção de capítulos; terminar é quase platinar.' },
      { platform: 'steam', externalId: '330830', estimate: '9–11h', note: 'A mesma fórmula Telltale: história boa, 100% garantido.' },
      { platform: 'steam', externalId: '498240', estimate: '8–10h', note: 'Conquistas de história do início ao fim, zero perdíveis.' },
      { platform: 'steam', externalId: '319630', estimate: '12–15h', note: 'Fotos opcionais por episódio, com seleção de cena depois.' },
      { platform: 'steam', externalId: '213670', estimate: '18–22h', note: 'Exige atenção aos perdíveis, mas cabe em poucas sessões.' },
      { platform: 'steam', externalId: '1172380', estimate: '25–30h', note: 'Campanha enxuta com exploração pós-jogo.' },
      { platform: 'steam', externalId: '203160', estimate: '25–35h', note: 'Campanha redonda; as conquistas multiplayer pedem paciência.' },
      { platform: 'steam', externalId: '2111190', estimate: '12–18h', note: 'Boomer shooter frenético; a dificuldade sobe no final.' },
      { platform: 'steam', externalId: '764790', estimate: '15–20h', note: 'Metroidvania ágil com colecionáveis bem sinalizados.' },
      { platform: 'steam', externalId: '774361', estimate: '25–35h', note: 'Desafiador, compacto e com identidade própria.' },
      { platform: 'steam', externalId: '613830', estimate: '20–25h', note: 'Treze conquistas; a maioria vem de finais múltiplos no NG+.' },
      { platform: 'steam', externalId: '960910', estimate: '20–25h', note: 'Vários finais com seleção de capítulo; drama garantido.' },
      { platform: 'steam', externalId: '1140270', estimate: '10–15h', note: 'Mesma pegada do primeiro, que já rendeu boas noites.' },
      { platform: 'steam', externalId: '1665190', estimate: '12–18h', note: 'Roadtrip com runs curtas; ótimo entre projetos grandes.' },
      { platform: 'steam', externalId: '3731020', estimate: '8–12h', note: 'A primeira temporada já está em 100%; a segunda segue igual.' },
      { platform: 'steam', externalId: '1173780', estimate: '10–15h', note: 'Pixel Remaster com boosts oficiais; sem grind real.' },
      { platform: 'steam', externalId: '1943950', estimate: '15–25h', note: 'Horror coop por níveis; avança rápido com grupo fixo.' },
      { platform: 'steam', externalId: '462780', estimate: '25–30h', note: 'Ação clássica: uma run forte e limpeza apocalíptica.' },
      { platform: 'steam', externalId: '546200', estimate: '4–6h', note: 'Casual de tarde chuvosa; 100% quase automático.' },
      { platform: 'psn', externalId: 'NPWR00483_00', estimate: '15–25h', note: 'Platina antiga, simples e direta.' },
    ],
  },
  {
    id: 'demanding',
    label: 'Projetos longos',
    shortLabel: 'Longos',
    description: 'Você já começou, mas terminar pede férias mentais, planilha ou uma relação séria com o jogo.',
    entries: [
      { platform: 'steam', externalId: '367520', estimate: '20–40h', note: 'Falta uma conquista, só que ela é o Panteão de Hallownest.' },
      { platform: 'steam', externalId: '1030300', estimate: '25–50h', note: 'A 90%, mas a reta final guarda os desafios mais cruéis.' },
      { platform: 'steam', externalId: '292030', estimate: '70–120h', note: 'Muito conteúdo restante e conquistas perdíveis.' },
      { platform: 'steam', externalId: '1086940', estimate: '80–140h', note: 'Múltiplas rotas, escolhas e o modo Honra no horizonte.' },
      { platform: 'steam', externalId: '49520', estimate: '60–100h', note: 'DLCs e níveis altos esticam a reta final.' },
      { platform: 'steam', externalId: '377840', estimate: '60–100h', note: 'Excalibur II não perdoa: é run planejada do zero.' },
      { platform: 'steam', externalId: '1151640', estimate: '40–60h', note: 'Base tranquila; Frozen Wilds sobe o tom no final.' },
      { platform: 'steam', externalId: '262060', estimate: '100h+', note: 'Runs exigentes, RNG e modos de dificuldade.' },
      { platform: 'steam', externalId: '678960', estimate: '50–70h', note: 'Múltiplos finais pedem New Game+ e planejamento.' },
      { platform: 'steam', externalId: '1004640', estimate: '60–90h', note: 'Tática densa com colecionáveis de longo prazo.' },
      { platform: 'steam', externalId: '1627720', estimate: '60–90h', note: 'Três finais e upgrades completos: caminho de NG++.' },
      { platform: 'steam', externalId: '1145360', estimate: '70–100h', note: 'O epílogo verdadeiro cobra dezenas de escapadas.' },
      { platform: 'steam', externalId: '1091500', estimate: '70–100h', note: 'Excelente projeto grande, mas pede limpeza de mapa.' },
      { platform: 'steam', externalId: '814380', estimate: '60–90h', note: 'Todos os finais e todos os chefes; skill pura.' },
      { platform: 'steam', externalId: '570940', estimate: '80–100h', note: 'Covenants e anéis raros significam NG++.' },
      { platform: 'steam', externalId: '20920', estimate: '40–60h', note: 'Dois caminhos distintos e a dificuldade Insana no meio.' },
      { platform: 'steam', externalId: '391220', estimate: '70–100h', note: '143 conquistas com modos extras e DLCs.' },
      { platform: 'steam', externalId: '271590', estimate: '80–120h', note: '100% do mapa e as heists do online no pacote.' },
      { platform: 'steam', externalId: '3321460', estimate: '80–120h', note: 'Mundo aberto gigante e recém-lançado; sem pressa.' },
      { platform: 'steam', externalId: '349040', estimate: '40–60h', note: 'Colecionáveis e desafios de liga esticam a conta.' },
    ],
  },
  {
    id: 'essential',
    label: 'Vale cada hora',
    shortLabel: 'Essenciais',
    description: 'Não são necessariamente os mais fáceis. São os que mais merecem virar uma lembrança completa na conta.',
    entries: [
      { platform: 'steam', externalId: '367520', estimate: '20–40h', note: 'A última conquista é lendária; fechá-la é história para contar.' },
      { platform: 'steam', externalId: '1030300', estimate: '25–50h', note: 'O 100% mais digno de encerrar o ano no Hall.' },
      { platform: 'steam', externalId: '1086940', estimate: '80–140h', note: 'Uma platina que conta uma história só sua.' },
      { platform: 'steam', externalId: '292030', estimate: '70–120h', note: 'Clássico absoluto para finalmente fechar a conta.' },
      { platform: 'steam', externalId: '1145360', estimate: '70–100h', note: 'O loop faz o grind parecer parte da diversão.' },
      { platform: 'steam', externalId: '814380', estimate: '60–90h', note: 'Difícil, justo e muito satisfatório de dominar.' },
      { platform: 'steam', externalId: '1627720', estimate: '60–90h', note: 'Uma ótima ponte entre Souls e narrativa fechada.' },
      { platform: 'steam', externalId: '1091500', estimate: '70–100h', note: 'Night City merece a limpeza completa.' },
      { platform: 'steam', externalId: '2050650', estimate: '70–100h', note: 'Campanhas repetidas, mas com execução deliciosa.' },
      { platform: 'steam', externalId: '1313140', estimate: '50–80h', note: 'Carisma suficiente para sustentar a limpeza completa.' },
      { platform: 'steam', externalId: '774361', estimate: '35–55h', note: 'Desafiador, compacto e com identidade própria.' },
      { platform: 'steam', externalId: '1850570', estimate: '100–140h', note: 'Uma Kojimada com planilha, mas a viagem vale a pena.' },
      { platform: 'steam', externalId: '524220', estimate: '50–70h', note: 'A rota E está entre as memórias mais bonitas do meio.' },
      { platform: 'steam', externalId: '413150', estimate: '120–150h', note: 'Perfection é projeto de estação, não de semana.' },
      { platform: 'steam', externalId: '250900', estimate: '500h+', note: '641 conquistas: o Everest da conta, para a vida toda.' },
      { platform: 'steam', externalId: '787480', estimate: '50–60h', note: 'A trilogia inteira vira uma única lembrança completa.' },
      { platform: 'steam', externalId: '377160', estimate: '100–140h', note: 'RPG confortável com DLCs incluídos na conta.' },
      { platform: 'steam', externalId: '435150', estimate: '150h+', note: 'Um dos melhores RPGs já feitos; 97 conquistas à altura.' },
      { platform: 'steam', externalId: '1462040', estimate: '80–100h', note: 'O modo difícil transforma o remake em outro jogo.' },
      { platform: 'steam', externalId: '460790', estimate: '40–60h', note: 'Pure Platinums são a escola clássica da ação estilosa.' },
    ],
  },
];
