export const communityPtBR = {
  eyebrow: 'Conteúdo compartilhado',
  title: 'Comunidade',
  description: 'Sagas e rankings escritos por outras pessoas, para você usar como guia sem mexer nos seus dados.',
  rankingsLink: 'Rankings',
  how: 'As publicações vêm dos packs da pasta `community/` do repositório e aparecem aqui somente para leitura. Para publicar, abra um PR com o seu pack (antes, valide com `npm run community:validate`).',
  groups: { saga: 'Sagas', ranking: 'Rankings curados' },
  space: {
    publications: { one: 'publicação', other: 'publicações' },
    updatedAt: 'atualizado em',
    empty: 'Este espaço ainda não tem publicações.',
  },
  publication: { version: 'v{version}' },
  attribution: {
    curatedBy: 'Curadoria de',
    space: 'espaço',
  },
  error: { title: 'Não foi possível carregar a comunidade', retry: 'Tentar de novo' },
  noSpaces: {
    title: 'Nenhum espaço publicado',
    body: 'Os espaços vêm das pastas em `community/`. Adicione um `space.json` e um pack para ele aparecer aqui.',
  },
  errors: { load: 'Falha ao carregar a comunidade' },
};
