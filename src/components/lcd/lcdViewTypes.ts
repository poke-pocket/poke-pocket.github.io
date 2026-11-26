/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import type { SpeciesMeta } from '../../data/catalog';
import type { MetaProgressState } from '../../data/metaProgression';
import type { PixelIconName } from '../../data/pixelIcons';
import type { GameSave, LcdMode, PetRecord, SpeciesId } from '../../types/pet';
import type { GachaOutcome, GachaTenOutcome } from '../../utils/petEngine';

export interface LcdSharedCtx {
  save: GameSave;
  pet: PetRecord;
  partyDetailPet: PetRecord;
  mode: LcdMode;
  selectedDexSpecies: SpeciesId;
  dexSpeciesMeta: SpeciesMeta;
  batchSelectedIds: string[];
  releasedTenIds: string[];
  gachaResult: GachaOutcome | null;
  gachaTenResult: GachaTenOutcome | null;
  STAT_BAR_ROWS: {
    key: 'hunger' | 'cleanliness' | 'happiness' | 'energy' | 'health';
    label: string;
    icon: PixelIconName;
    color: string;
  }[];
  setReleasedTenIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPetActionMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNewsPhotoIdx: React.Dispatch<React.SetStateAction<number>>;
  setPartySortBy: React.Dispatch<React.SetStateAction<'default' | 'level' | 'grade'>>;
  setBatchSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPartyBatchMode: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateMeta?: (updater: (prev: MetaProgressState) => MetaProgressState) => void;
  [key: string]: any;
}
