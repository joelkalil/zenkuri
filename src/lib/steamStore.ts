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
