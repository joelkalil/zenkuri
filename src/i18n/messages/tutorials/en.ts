import type { Shape } from '../../types';
import type { tutorialsPtBR } from './pt-BR';

export const tutorialsEn = {
  page: {
    title: 'Tutorials',
    lede: 'How to get the keys and identifiers Zenkuri needs to read your achievements from Steam, the PlayStation Network and RetroAchievements.',
  },
  labels: {
    purpose: 'What it is for',
    steps: 'Steps',
    where: 'Where to put the value',
    privacy: 'Privacy and safety',
    errors: 'Common errors',
    colValue: 'Value',
    colWho: 'Set by',
    colWhere: 'Where',
    scopeServer: 'Whoever runs the instance',
    scopeUser: 'Each user',
    envFile: '`.env` file',
    settingsPath: 'Settings > Connections',
    field: 'Field:',
    openSettings: 'Open Settings',
    problem: 'Symptom',
    fix: 'Fix',
    toolbarLabel: 'Available tutorials',
    external: '(opens in a new tab)',
  },
  overview: {
    title: 'Overview',
    serverTitle: 'Server keys',
    serverBody: 'They live in the `.env` file and are set by whoever runs the Zenkuri instance. They only take effect after the server restarts.',
    userTitle: 'User identifiers',
    userBody: 'The SteamID64, the PSN Online ID and the RetroAchievements username are entered by each person in Settings > Connections. They are public profile data, never passwords.',
    indexTitle: 'Pick a platform',
  },
  values: {
    steamKey: 'Steam Web API key',
    steamId: 'SteamID64 or profile URL',
    npsso: 'NPSSO token',
    onlineId: 'Online ID (PSN username)',
    raKey: 'Web API Key',
    raServiceUser: 'Username that owns the key',
    raUser: 'Username',
  },
  steam: {
    purpose: 'Lets Zenkuri read your Steam profile, library and achievements. The server uses a Web API key; each person only enters their own SteamID64 or profile URL.',
    serverPart: 'Server key',
    userPart: 'Your identifier',
    serverSteps: {
      s1: 'Log in to your Steam account and open the key registration page.',
      s2: 'Under "Domain Name", enter any domain, for example `localhost`. Zenkuri does not depend on this value.',
      s3: 'Agree to the Steam Web API terms and confirm the registration.',
      s4: 'Copy the key shown and save it in `.env` as `ZENKURI_STEAM_API_KEY`.',
      s5: 'Restart the server.',
    },
    userSteps: {
      u1: 'Open your Steam profile editor and look at the custom URL field, or copy your profile URL from the browser address bar.',
      u2: 'Use the SteamID64 (17 digits), the `steamcommunity.com/profiles/…` URL or the custom `steamcommunity.com/id/…` URL.',
      u3: 'In Settings > Connections, choose Steam, paste the value and click Link.',
    },
    links: {
      apiKey: 'steamcommunity.com/dev/apikey',
      editProfile: 'steamcommunity.com/my/edit',
      privacy: 'steamcommunity.com/my/edit/settings',
    },
    privacy: {
      p1: 'Never share the Web API key. It identifies your account in Steam calls: do not publish `.env` or commit it.',
      p2: 'Your profile and "Game details" must be Public for achievements to show up.',
      p3: 'Zenkuri only reads public data and never asks for your Steam password.',
    },
    errors: {
      e1: {
        problem: 'The library shows up, but without achievements.',
        fix: 'Your profile or "Game details" are not Public. Fix the privacy setting and update again.',
      },
      e2: {
        problem: 'The Steam key is invalid or has expired.',
        fix: 'The key was revoked or your Steam password changed. Generate a new key, update `ZENKURI_STEAM_API_KEY` in `.env` and restart the server.',
      },
      e3: {
        problem: 'Profile not found when linking.',
        fix: 'Check the SteamID64 or the URL. For custom URLs, the name must actually exist.',
      },
      e4: {
        problem: 'The server says the key is not configured.',
        fix: 'The `ZENKURI_STEAM_API_KEY` variable is empty or missing in `.env`, or the server was not restarted after the change.',
      },
    },
  },
  psn: {
    purpose: 'Lets Zenkuri read your PlayStation Network trophies. The server uses an NPSSO session token; each person only enters their own Online ID.',
    serverPart: 'Server token',
    userPart: 'Your identifier',
    serverSteps: {
      s1: 'In your browser, log in to your account at playstation.com.',
      s2: 'In the same browser, open the ssocookie address.',
      s3: 'The page shows JSON with an `npsso` field. Copy the 64 characters of its value.',
      s4: 'Save it in `.env` as `ZENKURI_PSN_NPSSO` and restart the server.',
    },
    userSteps: {
      u1: 'Your Online ID is your PSN username, the same one shown on your profile and on the console.',
      u2: 'In Settings > Connections, choose PSN, enter the Online ID and click Link.',
    },
    links: {
      site: 'playstation.com',
      ssoCookie: 'ca.account.sony.com/api/v1/ssocookie',
    },
    privacy: {
      p1: 'The NPSSO is equivalent to a session token for your Sony account. Never share it, do not publish `.env` and do not commit it.',
      p2: 'The token expires after roughly 2 months. When that happens, generate a new one with the same steps.',
      p3: 'For trophies to show up, your profile privacy must allow it: Settings > Privacy > Gaming | Media > trophies.',
    },
    errors: {
      e1: {
        problem: 'Update fails saying the credential expired.',
        fix: 'The NPSSO expired. Generate a new token, update `ZENKURI_PSN_NPSSO` in `.env` and restart the server.',
      },
      e2: {
        problem: 'Profile not found when linking.',
        fix: 'Check the exact spelling of the Online ID, with no extra spaces.',
      },
      e3: {
        problem: 'The profile links, but no trophies show up.',
        fix: 'Your trophy privacy does not allow reading. Change it under Privacy > Gaming | Media and update again.',
      },
      e4: {
        problem: 'The ssocookie address shows an error instead of the `npsso`.',
        fix: 'You are not logged in. Log in at playstation.com in the same browser and open the address again.',
      },
    },
  },
  retroachievements: {
    purpose: 'Lets Zenkuri read your retro achievements. The server uses a RetroAchievements Web API Key; each person only enters their own username.',
    serverPart: 'Server key',
    userPart: 'Your identifier',
    serverSteps: {
      s1: 'Log in to RetroAchievements and open your account settings.',
      s2: 'In the "Keys" section, copy the "Web API Key".',
      s3: 'Save it in `.env` as `ZENKURI_RA_API_KEY` and put the username of the account that owns the key in `ZENKURI_RA_USERNAME`.',
      s4: 'Restart the server.',
    },
    userSteps: {
      u1: 'Your username is your RetroAchievements account name, the same one in your profile address.',
      u2: 'In Settings > Connections, choose RetroAchievements, enter the username and click Link.',
    },
    links: {
      settings: 'retroachievements.org/settings',
    },
    privacy: {
      p1: 'Never share the Web API Key: it gives API access on behalf of your account. If it leaks, generate another one in the settings.',
      p2: 'Zenkuri only reads public profile data and never asks for your password.',
    },
    errors: {
      e1: {
        problem: 'Authentication error while updating.',
        fix: 'Check that `ZENKURI_RA_USERNAME` owns the key in `ZENKURI_RA_API_KEY`, with no stray spaces, and restart the server.',
      },
      e2: {
        problem: 'Username not found when linking.',
        fix: 'Check the spelling of your profile username.',
      },
      e3: {
        problem: 'The server says the variables are not configured.',
        fix: 'Set `ZENKURI_RA_USERNAME` and `ZENKURI_RA_API_KEY` in `.env` and restart the server.',
      },
    },
  },
} satisfies Shape<typeof tutorialsPtBR>;
