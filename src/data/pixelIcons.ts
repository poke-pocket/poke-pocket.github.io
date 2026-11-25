export type PixelIconName =
  | 'paw'
  | 'riceball'
  | 'meat'
  | 'bubble'
  | 'gamepad'
  | 'bulb'
  | 'sun'
  | 'moon'
  | 'pill'
  | 'bow'
  | 'chart'
  | 'coin'
  | 'heart'
  | 'heart_empty'
  | 'bolt'
  | 'smile'
  | 'shop'
  | 'book'
  | 'trophy'
  | 'lock'
  | 'egg'
  | 'sprout'
  | 'crown'
  | 'sparkle'
  | 'sound_on'
  | 'sound_off'
  | 'house'
  | 'dice'
  | 'bomb'
  | 'star'
  | 'fish'
  | 'eyes'
  | 'arrow_up'
  | 'pokeball'
  | 'fire'
  | 'leaf'
  | 'water'
  | 'menu'
  | 'bag'
  | 'gift'
  | 'ghost'
  | 'psychic'
  | 'play'
  | 'fullscreen'
  | 'shrink'
  | 'sword'
  | 'clock'
  | 'replay'
  | 'arrow_left';

export interface PixelIconDef {
  grid: string[];
  palette: Record<string, string>;
}

// Crisp 10x10 pixel-art UI icons
export const PIXEL_ICONS: Record<PixelIconName, PixelIconDef> = {
  paw: {
    palette: { K: '#23212d', P: '#ff8da6', B: '#e08d58' },
    grid: [
      '..KK..KK..',
      '.KBBKKBBK.',
      'KKBBKKBBKK',
      'KBBK..KBBK',
      '.KK.KK.KK.',
      '..KKBBKK..',
      '.KBBBBBBK.',
      '.KBBPPBBK.',
      '..KPPPPK..',
      '...KKKK...',
    ],
  },
  arrow_left: {
    palette: { K: '#161420', W: '#ffffff', Y: '#ffe066' },
    grid: [
      '..........',
      '....KK....',
      '...KWK....',
      '..KWWKKKK.',
      '.KWWYYYYWK',
      '.KWWYYYYWK',
      '..KWWKKKK.',
      '...KWK....',
      '....KK....',
      '..........',
    ],
  },
  riceball: {
    palette: { K: '#23212d', W: '#ffffff', S: '#d9d4c7', N: '#2b3a2e' },
    grid: [
      '....KK....',
      '...KWWK...',
      '..KWWWWK..',
      '.KWWWWWWK.',
      '.KWWSSWWK.',
      'KWWNNNNWWK',
      'KWWNNNNWWK',
      'KSSNNNNSSK',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  meat: {
    palette: { K: '#23212d', R: '#e66445', H: '#ffa987', W: '#fff8ec' },
    grid: [
      '....KKKK..',
      '...KRRRRK.',
      '..KRRHRRRK',
      '..KRRRRRRK',
      '..KRRRRKK.',
      '..KKRRKK..',
      '.KWWKK....',
      'KWWK......',
      'KWWK......',
      '.KK.......',
    ],
  },
  bubble: {
    palette: { K: '#1d4d6b', B: '#74c0fc', L: '#d0ebff', W: '#ffffff' },
    grid: [
      '..........',
      '..KKKK....',
      '.KLLWWK...',
      'KLWBBBBK..',
      'KBBBBBBK..',
      '.KBBBBKK..',
      '..KKKK.KK.',
      '......KLLK',
      '......KBBK',
      '.......KK.',
    ],
  },
  gamepad: {
    palette: { K: '#23212d', G: '#adb5bd', D: '#495057', R: '#ff4f79', Y: '#ffd43b' },
    grid: [
      '..........',
      '.KKKKKKKK.',
      'KGGGGGGGGK',
      'KGDGGGGGYK',
      'KGDDGGGRGK',
      'KGDGGGGGGK',
      'KGGGGGGGGK',
      '.KKK..KKK.',
      '..........',
      '..........',
    ],
  },
  bulb: {
    palette: { K: '#23212d', Y: '#ffe066', W: '#fff9db', G: '#adb5bd' },
    grid: [
      '...KKKK...',
      '..KYYYYK..',
      '.KYWWYYYK.',
      '.KYYYYYYK.',
      '.KYYYYYYK.',
      '..KYYYYK..',
      '...KKKK...',
      '...KGGK...',
      '...KGGK...',
      '....KK....',
    ],
  },
  sun: {
    palette: { K: '#7a4b00', Y: '#ffd43b', O: '#ff922b' },
    grid: [
      '....OO....',
      '.O..KK..O.',
      '..KYYYYK..',
      '.KYYYYYYK.',
      'OKYYYYYYKO',
      '.KYYYYYYK.',
      '..KYYYYK..',
      '.O..KK..O.',
      '....OO....',
      '..........',
    ],
  },
  moon: {
    palette: { K: '#3b3315', Y: '#ffe066', O: '#fcc419' },
    grid: [
      '....KKKK..',
      '...KYYYK..',
      '..KYYYK...',
      '..KYYK....',
      '..KYYK....',
      '..KYYYK...',
      '...KYYYK..',
      '....KKKK..',
      '..........',
      '..........',
    ],
  },
  pill: {
    palette: { K: '#23212d', R: '#ff4d6d', W: '#ffffff', H: '#ffb3c1' },
    grid: [
      '....KKKK..',
      '...KRRRRK.',
      '..KRRHRRRK',
      '..KRRRRKK.',
      '..KWWWKK..',
      '.KWWWWK...',
      'KWWWWK....',
      'KWWWK.....',
      '.KKK......',
      '..........',
    ],
  },
  bow: {
    palette: { K: '#23212d', R: '#ff4f79', H: '#ffa6be' },
    grid: [
      '..........',
      '.KK....KK.',
      'KRRK..KRRK',
      'KRHK..KHRK',
      'KRRRKKRRRK',
      'KRRKKKKRRK',
      '.KK....KK.',
      '..........',
      '..........',
      '..........',
    ],
  },
  chart: {
    palette: { K: '#23212d', G: '#51cf66', B: '#4dabf7', Y: '#ffd43b' },
    grid: [
      '.......KK.',
      '......KGGK',
      '....KKKGGK',
      '...KBBKGGK',
      '.KKKBBKGGK',
      'KYYKBBKGGK',
      'KYYKBBKGGK',
      'KYYKBBKGGK',
      'KKKKKKKKKK',
      '..........',
    ],
  },
  coin: {
    palette: { K: '#4d3600', Y: '#ffd43b', O: '#f59f00', W: '#fff9db' },
    grid: [
      '..KKKKKK..',
      '.KYYYYYYK.',
      'KYWYYOYYYK',
      'KYYYOYYYYK',
      'KYYYOYYYYK',
      'KYYYOYYYYK',
      'KYYYYOYYYK',
      '.KYYYYYYK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  heart: {
    palette: { K: '#3b1521', R: '#ff4f79', H: '#ffb3c6' },
    grid: [
      '.KKK..KKK.',
      'KRHHKKRRRK',
      'KRHHRRRRRK',
      'KRRRRRRRRK',
      'KRRRRRRRRK',
      '.KRRRRRRK.',
      '..KRRRRK..',
      '...KRRK...',
      '....KK....',
      '..........',
    ],
  },
  heart_empty: {
    palette: { K: '#3b1521', W: '#f1f3f5' },
    grid: [
      '.KKK..KKK.',
      'KWWWKKWWWK',
      'KWWWWWWWWK',
      'KWWWWWWWWK',
      'KWWWWWWWWK',
      '.KWWWWWWK.',
      '..KWWWWK..',
      '...KWWK...',
      '....KK....',
      '..........',
    ],
  },
  bolt: {
    palette: { K: '#4a3600', Y: '#ffe066', O: '#fcc419' },
    grid: [
      '....KKKK..',
      '...KYYYK..',
      '..KYYYK...',
      '.KYYYYYKK.',
      'KYYYYYYYK.',
      '.KKKKYYK..',
      '....KYK...',
      '...KYK....',
      '..KKK.....',
      '..........',
    ],
  },
  smile: {
    palette: { K: '#23212d', Y: '#ffe066', B: '#ff8da6' },
    grid: [
      '..KKKKKK..',
      '.KYYYYYYK.',
      'KYYKYYKYYK',
      'KYYKYYKYYK',
      'KYBYYYYBYK',
      'KYYKYYKYYK',
      'KYYYKKYYYK',
      '.KYYYYYYK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  shop: {
    palette: { K: '#23212d', R: '#ff595e', W: '#ffffff', Y: '#ffe8a3', B: '#74c0fc' },
    grid: [
      '.KKKKKKKK.',
      'KRRWWRRWWR',
      'KRRWWRRWWR',
      'KKKKKKKKKK',
      '.KYYYYYYK.',
      '.KYBBYYYK.',
      '.KYBBYYYK.',
      '.KYYYYYYK.',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  book: {
    palette: { K: '#23212d', B: '#748ffc', W: '#ffffff', Y: '#ffd43b' },
    grid: [
      '.KKKKKKKK.',
      'KBBBBBBBBK',
      'KBWWWWWWBK',
      'KBBYYYYBBK',
      'KBWWWWWWBK',
      'KBBBBBBBBK',
      'KWWWWWWWWK',
      'KBBBBBBBBK',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  trophy: {
    palette: { K: '#423000', Y: '#ffd43b', O: '#f08c00', W: '#fff9db' },
    grid: [
      '.KKKKKKKK.',
      'KYYWYYYYYK',
      'KYYYYYYYYK',
      '.KYYYYYYK.',
      '..KYYYYK..',
      '...KYYK...',
      '...KYYK...',
      '..KOOOOOK.',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  lock: {
    palette: { K: '#23212d', G: '#adb5bd', D: '#868e96' },
    grid: [
      '...KKKK...',
      '..K....K..',
      '..K....K..',
      '.KKKKKKKK.',
      '.KGGGGGGK.',
      '.KGGKKGGK.',
      '.KGGKKGGK.',
      '.KDDDDDDK.',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  egg: {
    palette: { K: '#23212d', C: '#fff3d6', S: '#f59e42' },
    grid: [
      '...KKKK...',
      '..KCCCCK..',
      '.KCSSCCCK.',
      '.KCSSCCCK.',
      'KCCCCCCSSK',
      'KCCCCCCSSK',
      'KCCSSCCCCK',
      '.KCCCCCCK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  sprout: {
    palette: { K: '#1e3522', G: '#51cf66', D: '#2f9e44' },
    grid: [
      '.KKK..KKK.',
      'KGGGK.KGGK',
      'KDDGGKGGDK',
      '.KKKDGDKK.',
      '....KK....',
      '....KK....',
      '....KK....',
      '...KKKK...',
      '..........',
      '..........',
    ],
  },
  crown: {
    palette: { K: '#3d2c00', Y: '#ffd43b', O: '#f08c00', R: '#ff4d6d' },
    grid: [
      '..........',
      '.K..KK..K.',
      'KYK.KYK.KY',
      'KYYKYYKYYK',
      'KRYRYYRYRK',
      'KOOOOOOOOK',
      '.KKKKKKKK.',
      '..........',
      '..........',
      '..........',
    ],
  },
  sparkle: {
    palette: { K: '#8c6d00', Y: '#ffe066', W: '#ffffff' },
    grid: [
      '....YY....',
      '....YY....',
      '..Y.WW.Y..',
      '.YYWWWWYY.',
      'YYWWWWWWYY',
      '.YYWWWWYY.',
      '..Y.WW.Y..',
      '....YY....',
      '....YY....',
      '..........',
    ],
  },
  sound_on: {
    palette: { K: '#23212d', G: '#495057', B: '#339af0' },
    grid: [
      '....KK....',
      '...KGK..B.',
      '.KKGGK...B',
      'KGGGGK.B.B',
      'KGGGGK.B.B',
      '.KKGGK...B',
      '...KGK..B.',
      '....KK....',
      '..........',
      '..........',
    ],
  },
  sound_off: {
    palette: { K: '#23212d', G: '#868e96', R: '#fa5252' },
    grid: [
      '....KK....',
      '...KGK....',
      '.KKGGK.R.R',
      'KGGGGK..R.',
      'KGGGGK.R.R',
      '.KKGGK....',
      '...KGK....',
      '....KK....',
      '..........',
      '..........',
    ],
  },
  house: {
    palette: { K: '#23212d', R: '#ff6b6b', W: '#fff9ec', B: '#a0653a' },
    grid: [
      '....KK....',
      '...KRRK...',
      '..KRRRRK..',
      '.KRRRRRRK.',
      'KKKKKKKKKK',
      '.KWWWWWWK.',
      '.KWWBBWWK.',
      '.KWWBBWWK.',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  dice: {
    palette: { K: '#23212d', W: '#ffffff', D: '#23212d' },
    grid: [
      '.KKKKKKKK.',
      'KWWWWWWWWK',
      'KWDDWWDDWK',
      'KWDDWWDDWK',
      'KWWWDDWWWK',
      'KWDDWWDDWK',
      'KWDDWWDDWK',
      'KWWWWWWWWK',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  bomb: {
    palette: { K: '#181920', D: '#343a40', W: '#dee2e6', F: '#ff922b', Y: '#ffe066' },
    grid: [
      '......FY..',
      '.....KF...',
      '....KK....',
      '..KKKKKK..',
      '.KDDDDDDK.',
      'KDDWWDDDDK',
      'KDDDDDDDDK',
      '.KDDDDDDK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  star: {
    palette: { K: '#5c3d00', Y: '#ffd43b', W: '#fff9db' },
    grid: [
      '....KK....',
      '...KYYK...',
      '.KKKWWKKK.',
      'KYYYYYYYYK',
      '.KYYYYYYK.',
      '..KYYYYK..',
      '.KYYKKYYK.',
      'KYKK..KKYK',
      '..........',
      '..........',
    ],
  },
  fish: {
    palette: { K: '#281d17', O: '#f09446', H: '#ffd08e', W: '#ffffff' },
    grid: [
      '..........',
      '...KKKK...',
      '.KKOHHOKK.',
      'KWKOOOOOKK',
      '.KKOOOOOKK',
      '...KKKK.KK',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  eyes: {
    palette: { K: '#23212d', W: '#ffffff', B: '#3b5bdb' },
    grid: [
      '..........',
      '.KKK..KKK.',
      'KWWWK.KWWW',
      'KWBKK.KWBK',
      'KWBKK.KWBK',
      '.KKK..KKK.',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  arrow_up: {
    palette: { K: '#1f3a24', G: '#51cf66', L: '#b2f2bb' },
    grid: [
      '....KK....',
      '...KLLK...',
      '..KLGGLK..',
      '.KGGGGGGK.',
      'KGGKKKKGGK',
      '.KK.GG.KK.',
      '....GG....',
      '....GG....',
      '....KK....',
      '..........',
    ],
  },
  pokeball: {
    palette: { K: '#23212d', R: '#ef4444', H: '#fca5a5', W: '#ffffff', S: '#d1d5db' },
    grid: [
      '..KKKKKK..',
      '.KRHRRRRK.',
      'KRRRRRRRRK',
      'KRRRRRRRRK',
      'KKKKWWKKKK',
      'KWWKWWKWWK',
      'KWWKKKKWWK',
      '.KSWWWWWK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  fire: {
    palette: { K: '#45120a', R: '#ff4824', O: '#ff8524', Y: '#ffe047' },
    grid: [
      '....KK....',
      '...KRRK...',
      '..KRYYRK..',
      '.KROYYORK.',
      '.KROYYORK.',
      'KROOYYOORK',
      'KROYYYYORK',
      '.KROOOORK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  leaf: {
    palette: { K: '#19381f', G: '#40c057', L: '#8ce99a', D: '#2b8a3e' },
    grid: [
      '....KKKKK.',
      '...KGGLLGK',
      '..KGGGLGGK',
      '.KGGDGGGGK',
      '.KGDGGGGK.',
      '.KGDGGKK..',
      'KKDKKK....',
      'KK........',
      '..........',
      '..........',
    ],
  },
  water: {
    palette: { K: '#18345e', B: '#339af0', L: '#a5d8ff', W: '#ffffff' },
    grid: [
      '....KK....',
      '...KBBK...',
      '..KBLLBK..',
      '.KBWLBBBK.',
      '.KBBBBBBK.',
      'KBBBBBBBBK',
      'KBBBBBBBBK',
      '.KBBBBBBK.',
      '..KKKKKK..',
      '..........',
    ],
  },
  menu: {
    palette: { K: '#23212d', W: '#ffffff', Y: '#ffd43b', B: '#4dabf7' },
    grid: [
      '.KKKKKKKK.',
      'KWWWWWWWWK',
      'KWBBWWBBWK',
      'KWBBWWBBWK',
      'KWWWWWWWWK',
      'KWYYWWYYWK',
      'KWYYWWYYWK',
      'KWWWWWWWWK',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  bag: {
    palette: { K: '#23212d', R: '#d97706', H: '#fbbf24', B: '#78350f', Y: '#fef08a' },
    grid: [
      '...KKKK...',
      '..KBBBBK..',
      '.KKKKKKKK.',
      'KRRRRRRRRK',
      'KRHYYYYHRK',
      'KRRYYYYRRK',
      'KRRRRRRRRK',
      'KBBBBBBBBK',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  gift: {
    palette: { K: '#23212d', R: '#ff4d6d', W: '#fff0f3', Y: '#ffd43b' },
    grid: [
      '..KK..KK..',
      '.KYYKKYYK.',
      'KKKKKKKKKK',
      'KRRRYYRRRK',
      'KKKKKKKKKK',
      '.KWWYYWWK.',
      '.KWWYYWWK.',
      '.KWWYYWWK.',
      '.KKKKKKKK.',
      '..........',
    ],
  },
  ghost: {
    palette: { K: '#1f162e', P: '#9c6ade', L: '#d0bfff', E: '#ff4d6d' },
    grid: [
      '..KKKKKK..',
      '.KPPPPPPK.',
      'KPLPPPPPPK',
      'KPEEPPEEPK',
      'KPPPPPPPPK',
      'KPPPPPPPPK',
      'KPPKKKKPPK',
      'KPK.KK.KPK',
      '.K......K.',
      '..........',
    ],
  },
  psychic: {
    palette: { K: '#3b1530', P: '#f06595', L: '#ffdeeb', W: '#ffffff' },
    grid: [
      '....KK....',
      '..KKLLKK..',
      '.KPPPPPPK.',
      'KPWWPPPPPK',
      'KPWPPPPPPK',
      'KPPPPPPPPK',
      '.KPPPPPPK.',
      '..KKKKKK..',
      '..........',
      '..........',
    ],
  },
  play: {
    palette: { K: '#161420', W: '#ffffff', G: '#d3f9d8' },
    grid: [
      '.KK.......',
      '.KWKK.....',
      '.KWWKK....',
      '.KWWWKK...',
      '.KWWWWKK..',
      '.KWWWWKK..',
      '.KGGGKK...',
      '.KGGKK....',
      '.KGKK.....',
      '.KK.......',
    ],
  },
  fullscreen: {
    palette: { K: '#161420', Y: '#ffe066' },
    grid: [
      'KKKK..KKKK',
      'KYYK..KYYK',
      'KYK....KYK',
      'KK......KK',
      '..........',
      '..........',
      'KK......KK',
      'KYK....KYK',
      'KYYK..KYYK',
      'KKKK..KKKK',
    ],
  },
  shrink: {
    palette: { K: '#161420', B: '#74c0fc' },
    grid: [
      '..........',
      '..KK..KK..',
      '.KBBKKBBK.',
      '.KBBKKBBK.',
      '..KK..KK..',
      '..KK..KK..',
      '.KBBKKBBK.',
      '.KBBKKBBK.',
      '..KK..KK..',
      '..........',
    ],
  },
  sword: {
    palette: { K: '#161420', S: '#e9ecef', B: '#adb5bd', G: '#ffd43b', W: '#a05a2c' },
    grid: [
      '.......KKK',
      '......KSSK',
      '.....KSSBK',
      '....KSSBK.',
      '...KSSBK..',
      '.KKSSBK...',
      '.KGGKK....',
      '..KGGK....',
      '.KWWK.....',
      '.KKK......',
    ],
  },
  clock: {
    palette: { K: '#161420', W: '#fffdf5', B: '#4dabf7', R: '#ff4d4d' },
    grid: [
      '..KKKKKK..',
      '.KBBBBBBK.',
      'KBWWWWWWBK',
      'KBWWKWWWBK',
      'KBWWKWWWBK',
      'KBWWKRRWBK',
      'KBWWWWWWBK',
      'KBWWWWWWBK',
      '.KBBBBBBK.',
      '..KKKKKK..',
    ],
  },
  replay: {
    palette: { K: '#161420', G: '#51cf66', L: '#b2f2bb' },
    grid: [
      '...KKKKK..',
      '..KLLLLGK.',
      '.KGLKKKGGK',
      '.KGGK..KKK',
      '.KGGK.....',
      '.KGGK..KK.',
      '.KGGKKKGGK',
      '..KGGGGGK.',
      '...KKKKK..',
      '..........',
    ],
  },
};

const LEGACY_BADGE_MAP: Record<string, PixelIconName> = {
  '🥚': 'egg',
  '🍙': 'riceball',
  '🫧': 'bubble',
  '💕': 'heart',
  '♥': 'heart',
  '🌱': 'sprout',
  '👑': 'crown',
  '🎀': 'bow',
  '🕹️': 'gamepad',
  '✨': 'sparkle',
  '⬆️': 'arrow_up',
  '💊': 'pill',
  '🌙': 'moon',
  '☀️': 'sun',
  '🪙': 'coin',
  '🏆': 'trophy',
  '🔒': 'lock',
  '🐾': 'paw',
};

export function resolveBadgeIconName(badge: string): PixelIconName {
  if (badge in PIXEL_ICONS) {
    return badge as PixelIconName;
  }
  return LEGACY_BADGE_MAP[badge] ?? 'sparkle';
}
