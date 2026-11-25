export type PetAnimPose = 'idle0' | 'idle1' | 'happy' | 'sleep' | 'sad';

export interface PixelOverlay {
  grid: string[];
  palette: Record<string, string>;
}

export const POOP_SPRITE: PixelOverlay = {
  palette: { K: '#291e14', B: '#8b5e3c', L: '#b88358' },
  grid: [
    '....KK....',
    '...KBBK...',
    '..KBLBBK..',
    '.KBBBBBBK.',
    'KBLBBBBBBK',
    'KBBBBBBBBK',
    '.KKKKKKKK.',
  ],
};
