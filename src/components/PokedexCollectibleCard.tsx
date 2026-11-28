import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  POKEDEX_ORDER,
  SPECIES_CATALOG,
  getPokemonCryId,
  getPokemonPhysicalMetrics,
} from '../data/catalog';
import {
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  getSpeciesMoves,
  getTypeMultiplier,
} from '../data/battleMoves';
import type { GrowthStage, PokemonElement, RarityTier, SpeciesId } from '../types/pet';
import { sound } from '../utils/sound';
import { PixelIcon } from './PixelSprite';

export interface PokedexCollectibleCardProps {
  species: SpeciesId;
  stage: GrowthStage;
  discovered: boolean;
  closing?: boolean;
}

interface ElementCardTheme {
  frameGrad: string;
  bodyBg: string;
  artBg: string;
  edgeColor: string;
  accent: string;
  foilTint: string;
}

const ELEMENT_CARD_THEMES: Record<PokemonElement, ElementCardTheme> = {
  grass: {
    frameGrad: 'linear-gradient(135deg, #f6e08a 0%, #d4af37 32%, #fff3b0 54%, #b88c24 82%, #f0d268 100%)',
    bodyBg: 'linear-gradient(155deg, #d8f5a2 0%, #8ce99a 34%, #51cf66 72%, #2b8a3e 100%)',
    artBg: 'radial-gradient(circle at 50% 34%, #fff9db 0%, #b2f2bb 38%, #40c057 76%, #1b5e20 100%)',
    edgeColor: '#1e5628',
    accent: '#2b8a3e',
    foilTint: 'rgba(130, 255, 168, 0.42)',
  },
  fire: {
    frameGrad: 'linear-gradient(135deg, #ffe08a 0%, #e8891e 32%, #fff2be 52%, #b54512 84%, #f5b942 100%)',
    bodyBg: 'linear-gradient(155deg, #ffd8a8 0%, #ff922b 36%, #fa5252 74%, #a61e4d 100%)',
    artBg: 'radial-gradient(circle at 50% 34%, #fff3bf 0%, #ffc078 36%, #f76707 72%, #6e1414 100%)',
    edgeColor: '#7a1c14',
    accent: '#d9480f',
    foilTint: 'rgba(255, 152, 82, 0.44)',
  },
  water: {
    frameGrad: 'linear-gradient(135deg, #e7f5ff 0%, #74c0fc 32%, #ffffff 54%, #339af0 82%, #a5d8ff 100%)',
    bodyBg: 'linear-gradient(155deg, #d0ebff 0%, #74c0fc 36%, #339af0 74%, #1864ab 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #e7f5ff 0%, #74c0fc 40%, #1c7ed6 75%, #0b2d59 100%)',
    edgeColor: '#0e3c6b',
    accent: '#1864ab',
    foilTint: 'rgba(116, 214, 255, 0.45)',
  },
  electric: {
    frameGrad: 'linear-gradient(135deg, #fff3bf 0%, #fab005 32%, #ffffff 54%, #d98200 84%, #ffe066 100%)',
    bodyBg: 'linear-gradient(155deg, #fff9db 0%, #ffe066 36%, #fcc419 72%, #e67700 100%)',
    artBg: 'radial-gradient(circle at 50% 34%, #ffffff 0%, #fff3bf 38%, #fab005 74%, #5c3c00 100%)',
    edgeColor: '#7d4e00',
    accent: '#d98200',
    foilTint: 'rgba(255, 232, 102, 0.46)',
  },
  psychic: {
    frameGrad: 'linear-gradient(135deg, #ffdeeb 0%, #e599f7 32%, #fff0f6 54%, #9c36b5 82%, #f783ac 100%)',
    bodyBg: 'linear-gradient(155deg, #f3d9fa 0%, #da77f2 38%, #be4bdb 74%, #671b82 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #fff0f6 0%, #eebefa 38%, #ae3ec9 74%, #2d0b44 100%)',
    edgeColor: '#4a1163',
    accent: '#9c36b5',
    foilTint: 'rgba(238, 148, 255, 0.46)',
  },
  ghost: {
    frameGrad: 'linear-gradient(135deg, #e5dbff 0%, #9775fa 32%, #f3f0ff 54%, #5f3dc4 82%, #b197fc 100%)',
    bodyBg: 'linear-gradient(155deg, #d0bfff 0%, #845ef7 36%, #5f3dc4 74%, #2b1854 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #e5dbff 0%, #9775fa 38%, #4c2a85 74%, #130926 100%)',
    edgeColor: '#25134a',
    accent: '#5f3dc4',
    foilTint: 'rgba(177, 151, 252, 0.48)',
  },
  dragon: {
    frameGrad: 'linear-gradient(135deg, #ffe8a3 0%, #d4af37 28%, #dbe4ff 52%, #4263eb 80%, #ffd43b 100%)',
    bodyBg: 'linear-gradient(155deg, #dbe4ff 0%, #748ffc 36%, #4263eb 72%, #232c6b 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #fff9db 0%, #91a7ff 38%, #364fc7 74%, #141942 100%)',
    edgeColor: '#1b2259',
    accent: '#364fc7',
    foilTint: 'rgba(145, 180, 255, 0.48)',
  },
  fairy: {
    frameGrad: 'linear-gradient(135deg, #fff0f6 0%, #faa2c1 32%, #ffffff 54%, #d6336c 84%, #fcc2d7 100%)',
    bodyBg: 'linear-gradient(155deg, #ffdeeb 0%, #faa2c1 38%, #f06595 74%, #a61e4d 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #ffffff 0%, #ffdeeb 40%, #f06595 76%, #611232 100%)',
    edgeColor: '#75153a',
    accent: '#c2255c',
    foilTint: 'rgba(255, 168, 204, 0.46)',
  },
  normal: {
    frameGrad: 'linear-gradient(135deg, #f8f9fa 0%, #ced4da 32%, #ffffff 54%, #868e96 84%, #e9ecef 100%)',
    bodyBg: 'linear-gradient(155deg, #f8f9fa 0%, #e9ecef 38%, #ced4da 74%, #868e96 100%)',
    artBg: 'radial-gradient(circle at 50% 32%, #ffffff 0%, #e9ecef 42%, #adb5bd 78%, #343a40 100%)',
    edgeColor: '#495057',
    accent: '#495057',
    foilTint: 'rgba(240, 244, 255, 0.44)',
  },
};

const ALL_ELEMENTS: PokemonElement[] = [
  'grass',
  'fire',
  'water',
  'electric',
  'psychic',
  'ghost',
  'dragon',
  'fairy',
  'normal',
];

type CardCorner = 'tl' | 'tr' | 'bl' | 'br';

const CARD_CORNERS: { id: CardCorner; dir: -1 | 1; label: string }[] = [
  { id: 'tl', dir: -1, label: '左上角翻面' },
  { id: 'tr', dir: 1, label: '右上角翻面' },
  { id: 'bl', dir: -1, label: '左下角翻面' },
  { id: 'br', dir: 1, label: '右下角翻面' },
];

function computeCardHp(rarity: RarityTier, stage: GrowthStage): number {
  const rarityBase: Record<RarityTier, number> = {
    R: 70,
    SR: 90,
    SSR: 130,
  };
  const stageBonus = stage === 'adult' ? 80 : stage === 'teen' ? 40 : 0;
  return (rarityBase[rarity] ?? 70) + stageBonus;
}

export const PokedexCollectibleCard: React.FC<PokedexCollectibleCardProps> = ({
  species,
  stage,
  discovered,
  closing = false,
}) => {
  const meta = SPECIES_CATALOG[species];
  const cardTheme = ELEMENT_CARD_THEMES[meta.element] ?? ELEMENT_CARD_THEMES.normal;
  const isHoloRare = meta.rarity === 'SR' || meta.rarity === 'SSR';
  const isPrismatic = meta.rarity === 'SSR';

  const stages = useMemo<GrowthStage[]>(() => {
    if (meta.id === 'mew') return ['baby'];
    if (meta.evoLevels.adult === meta.evoLevels.teen) return ['baby', 'teen'];
    return ['baby', 'teen', 'adult'];
  }, [meta.id, meta.evoLevels.adult, meta.evoLevels.teen]);

  const activeStage: GrowthStage = stages.includes(stage) ? stage : 'baby';
  const stageTitle = discovered ? meta.stageNames[activeStage] : '???';
  const stageDexNo = meta.stageDexNos[activeStage];
  const stageCode =
    activeStage === 'adult' ? 'STAGE 2' : activeStage === 'teen' ? 'STAGE 1' : 'BASIC';
  const stageLevel =
    activeStage === 'adult'
      ? meta.evoLevels.adult
      : activeStage === 'teen'
        ? meta.evoLevels.teen
        : 5;

  const metrics = useMemo(
    () => getPokemonPhysicalMetrics(species, activeStage),
    [species, activeStage],
  );
  const moves = useMemo(() => getSpeciesMoves(species).slice(0, 2), [species]);
  const hpVal = computeCardHp(meta.rarity, activeStage);

  const weaknessEl = useMemo(
    () => ALL_ELEMENTS.find((el) => getTypeMultiplier(el, meta.element) > 1.1) ?? null,
    [meta.element],
  );
  const resistEl = useMemo(
    () =>
      ALL_ELEMENTS.find((el) => el !== meta.element && getTypeMultiplier(el, meta.element) < 0.9) ??
      null,
    [meta.element],
  );

  const dexRankNum = Math.max(1, POKEDEX_ORDER.indexOf(species) + 1);
  const dexTotalNum = POKEDEX_ORDER.length;

  const [flipDeg, setFlipDeg] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [cryAnimKey, setCryAnimKey] = useState(0);
  const [shineBurst, setShineBurst] = useState(false);
  const [tilt, setTilt] = useState({ rx: 2.5, ry: -4.5, mx: 36, my: 24, active: false });
  const cardBoxRef = useRef<HTMLDivElement | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const flipTimerRef = useRef<number | null>(null);

  const isBackShowing = Math.abs(Math.round(flipDeg / 180)) % 2 === 1;

  useEffect(() => {
    setFlipDeg(0);
  }, [species, stage]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardBoxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
    const py = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
    const ry = (px - 0.5) * 24;
    const rx = -(py - 0.5) * 20;
    setTilt({
      rx: Number(rx.toFixed(2)),
      ry: Number(ry.toFixed(2)),
      mx: Math.round(px * 100),
      my: Math.round(py * 100),
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 2.5, ry: -4.5, mx: 36, my: 24, active: false });
  };

  const triggerPokemonCry = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (discovered) {
      sound.playCry(getPokemonCryId(species, stageLevel));
    } else {
      sound.play('cursor');
    }
    setCryAnimKey((k) => k + 1);
    setShineBurst(false);
    window.requestAnimationFrame(() => setShineBurst(true));
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => setShineBurst(false), 620);
  };

  const triggerCornerFlip = (dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.play('cursor');
    setIsFlipping(true);
    setFlipDeg((prev) => prev + dir * 180);
    if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = window.setTimeout(() => setIsFlipping(false), 620);
  };

  const renderCornerFlipZones = () =>
    CARD_CORNERS.map((corner) => (
      <button
        key={corner.id}
        type="button"
        className={`tcg-corner-flip is-${corner.id}`}
        onClick={(e) => triggerCornerFlip(corner.dir, e)}
        aria-label={corner.label}
        title="点击角落翻面"
      />
    ));

  return (
    <div
      className={`collectible-card-dock ${closing ? 'is-exiting' : 'is-entering'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="poke-tcg-scaler">
        <div
          ref={cardBoxRef}
          className={`poke-tcg-scene ${tilt.active ? 'is-interacting' : ''} ${isFlipping ? 'is-flipping' : ''}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={
            {
              '--card-rx': `${tilt.rx}deg`,
              '--card-ry': `${tilt.ry}deg`,
              '--card-flip-deg': `${flipDeg}deg`,
              '--card-mx': `${tilt.mx}%`,
              '--card-my': `${tilt.my}%`,
              '--card-frame': cardTheme.frameGrad,
              '--card-body': cardTheme.bodyBg,
              '--card-art-bg': cardTheme.artBg,
              '--card-edge': cardTheme.edgeColor,
              '--card-accent': cardTheme.accent,
              '--card-foil-tint': cardTheme.foilTint,
            } as React.CSSProperties
          }
        >
          <div
            className={`poke-tcg-rotator ${isPrismatic ? 'is-prismatic' : isHoloRare ? 'is-holo-rare' : ''} ${shineBurst ? 'is-shine-burst' : ''}`}
          >
            {/* ==================== PHYSICAL FRONT FACE ==================== */}
            <div className={`poke-tcg-face poke-tcg-front ${isBackShowing ? 'is-hidden-face' : ''}`}>
              {/* Metallic Foil Rim + Embossed Cardstock Inner Body */}
              <div className="tcg-inner-stock">
                {/* Top Header Row: Stage Badge + Name + HP + Element Orb */}
                <div className="tcg-header-row">
                  <div className="tcg-title-group">
                    <span className={`tcg-stage-chip is-${activeStage}`}>{stageCode}</span>
                    <div className="tcg-name-stack">
                      <strong className="tcg-mon-name">{stageTitle}</strong>
                      <span className="tcg-mon-en">{discovered ? meta.english : 'MYSTERY'}</span>
                    </div>
                  </div>
                  <div className="tcg-hp-orb">
                    <span className="tcg-hp-label">HP</span>
                    <strong className="tcg-hp-val">{discovered ? hpVal : '??'}</strong>
                    <span
                      className="tcg-energy-medallion"
                      style={{ backgroundColor: meta.typeColor }}
                      title={meta.typeLabel}
                    >
                      <PixelIcon name={meta.typeIcon} size={16} />
                    </span>
                  </div>
                </div>

                {/* Gold-Beveled Holographic Artwork Window — Click Center Pokémon to Play Cry! */}
                <div className={`tcg-art-bevel ${discovered ? '' : 'is-mystery'}`}>
                  <div
                    className="tcg-art-stage"
                    onClick={triggerPokemonCry}
                    role="button"
                    tabIndex={0}
                    title={discovered ? `点击「${stageTitle}」听叫声` : '尚未收录的神秘精灵'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerPokemonCry(e);
                      }
                    }}
                  >
                    <span className="tcg-art-halo" aria-hidden="true" />
                    <span className="tcg-art-grid-pattern" aria-hidden="true" />
                    <span className="tcg-art-holo-stars" aria-hidden="true" />
                    {cryAnimKey > 0 && (
                      <span key={cryAnimKey} className="tcg-cry-wave" aria-hidden="true" />
                    )}
                    <img
                      key={`${species}-${activeStage}-${cryAnimKey}`}
                      src={meta.stageSprites[activeStage].animated}
                      alt={stageTitle}
                      className={`tcg-art-sprite ${discovered ? '' : 'is-silhouette'} ${cryAnimKey > 0 ? 'is-crying' : ''}`}
                      draggable={false}
                    />
                    {!discovered && (
                      <span className="tcg-mystery-q" aria-hidden="true">?</span>
                    )}
                    <span className={`tcg-rarity-foil r-${meta.rarity}`}>
                      {meta.rarity}
                      {isPrismatic ? ' ★' : ''}
                    </span>
                    <span className="tcg-art-dex-stamp">{stageDexNo}</span>
                  </div>
                </div>

                {/* Metallic Physical Spec Ribbon */}
                <div className="tcg-spec-ribbon">
                  <span>{stageDexNo}</span>
                  <span>·</span>
                  <span>{meta.typeLabel}宝可梦</span>
                  <span>·</span>
                  <span>身高 {discovered ? `${metrics.heightM}m` : '?.?m'}</span>
                  <span>·</span>
                  <span>体重 {discovered ? `${metrics.weightKg}kg` : '?.?kg'}</span>
                </div>

                {/* Signature Trait + Authentic Moves */}
                <div className="tcg-body-panel">
                  <div className="tcg-trait-banner">
                    <span className="tcg-trait-tag">特性</span>
                    <span className="tcg-trait-text">
                      {discovered ? meta.trait : '未知生态习性 · 捕获后解锁档案'}
                    </span>
                  </div>

                  <div className="tcg-moves-list">
                    {moves.map((mv, idx) => {
                      const moveCol = ELEMENT_COLORS[mv.element] ?? meta.typeColor;
                      const energyPips = mv.power >= 65 ? 2 : 1;
                      return (
                        <div key={mv.id} className="tcg-move-row">
                          <div className="tcg-move-cost">
                            {Array.from({ length: energyPips }).map((_, pi) => (
                              <span
                                key={pi}
                                className="tcg-pip"
                                style={{ backgroundColor: pi === 0 ? moveCol : '#adb5bd' }}
                              />
                            ))}
                          </div>
                          <div className="tcg-move-info">
                            <strong>{discovered ? mv.name : idx === 0 ? '神秘招式 I' : '神秘招式 II'}</strong>
                            <small>{discovered ? mv.description : '待图鉴收录后揭示招式详情'}</small>
                          </div>
                          <span className="tcg-move-pwr">
                            {discovered
                              ? mv.power > 0
                                ? `${mv.power + (activeStage === 'adult' ? 25 : activeStage === 'teen' ? 10 : 0)}`
                                : '辅助'
                              : '--'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weakness / Resistance / Retreat Footer */}
                <div className="tcg-stats-footer">
                  <div className="tcg-stat-cell">
                    <em>弱点</em>
                    {weaknessEl ? (
                      <span className="tcg-el-chip" style={{ backgroundColor: ELEMENT_COLORS[weaknessEl] }}>
                        {ELEMENT_LABELS[weaknessEl]} ×2
                      </span>
                    ) : (
                      <span>无</span>
                    )}
                  </div>
                  <div className="tcg-stat-cell">
                    <em>抵抗</em>
                    {resistEl ? (
                      <span className="tcg-el-chip" style={{ backgroundColor: ELEMENT_COLORS[resistEl] }}>
                        {ELEMENT_LABELS[resistEl]} -30
                      </span>
                    ) : (
                      <span>无</span>
                    )}
                  </div>
                  <div className="tcg-stat-cell">
                    <em>撤退</em>
                    <span className="tcg-retreat-stars">
                      {activeStage === 'adult' ? '★★' : '★'}
                    </span>
                  </div>
                </div>

                {/* Flavor Lore & Foil Collector Edition Serial */}
                <p className="tcg-flavor-note">
                  {discovered
                    ? meta.description
                    : '在 3D 野外或市场盲盒中邂逅它，点亮这张专属全息珍藏闪卡！'}
                </p>
                <div className="tcg-serial-bar">
                  <span>POKé POCKET · {isPrismatic ? 'PRISM HOLO' : 'COLLECTOR'}</span>
                  <span>
                    {String(dexRankNum).padStart(3, '0')}/{String(dexTotalNum).padStart(3, '0')} ★
                  </span>
                </div>
              </div>

              {/* Dynamic Holographic Foil & Specular Glare Overlays (pure GPU composite!) */}
              <div className="tcg-holo-foil" aria-hidden="true" />
              <div className="tcg-specular-glare" aria-hidden="true" />

              {/* Four Interactive Corner Flip Hit-Zones */}
              {renderCornerFlipZones()}
            </div>

            {/* ==================== PHYSICAL EMBOSSED BACK FACE ==================== */}
            <div className={`poke-tcg-face poke-tcg-back ${!isBackShowing ? 'is-hidden-face' : ''}`}>
              <div className="tcg-back-border">
                <div className="tcg-back-inner">
                  <div className="tcg-back-rays" aria-hidden="true" />
                  <div className="tcg-back-title-top">POKé POCKET</div>
                  <div className="tcg-back-ball" aria-hidden="true">
                    <span className="tcg-ball-top" />
                    <span className="tcg-ball-band" />
                    <span className="tcg-ball-core" />
                  </div>
                  <div className="tcg-back-title-bot">COLLECTOR EDITION</div>
                </div>
              </div>
              <div className="tcg-specular-glare" aria-hidden="true" />

              {/* Four Interactive Corner Flip Hit-Zones on Back Face Too */}
              {renderCornerFlipZones()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
