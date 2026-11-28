import React, { useId, useMemo } from 'react';
import { SPECIES_CATALOG } from '../data/catalog';
import { PIXEL_ICONS, type PixelIconName } from '../data/pixelIcons';
import type { PixelOverlay } from '../data/sprites';
import type { GrowthStage, SpeciesId } from '../types/pet';
import type { PetAnimPose } from '../data/sprites';

interface PixelGridProps {
  grid: string[];
  palette: Record<string, string>;
  size?: number;
  className?: string;
}

/**
 * Merges consecutive horizontal pixel runs per fill color into ONE `<path>` per palette color!
 * Reduces a 24×24 pixel medallion from 468 `<rect>` DOM nodes down to ~5 `<path>` nodes (93% fewer DOM nodes!)
 * with 100% pixel-identical `crispEdges` rendering.
 */
export const PixelGrid: React.FC<PixelGridProps> = React.memo(({
  grid,
  palette,
  size = 64,
  className,
}) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 16;

  const colorPaths = useMemo(() => {
    const byColor = new Map<string, string[]>();
    for (let y = 0; y < rows; y++) {
      const row = grid[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '.') {
          x++;
          continue;
        }
        const fill = palette[ch];
        if (!fill) {
          x++;
          continue;
        }
        let runEnd = x + 1;
        while (runEnd < row.length && row[runEnd] === ch) runEnd++;
        const w = runEnd - x;
        let segs = byColor.get(fill);
        if (!segs) {
          segs = [];
          byColor.set(fill, segs);
        }
        segs.push(`M${x} ${y}h${w}v1h-${w}z`);
        x = runEnd;
      }
    }
    return Array.from(byColor.entries()).map(([fill, segs]) => ({
      fill,
      d: segs.join(''),
    }));
  }, [grid, palette, rows]);

  return (
    <svg
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {colorPaths.map((p) => (
        <path key={p.fill} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
});

interface PixelOverlayIconProps {
  sprite: PixelOverlay;
  size?: number;
  className?: string;
}

export const PixelOverlayIcon: React.FC<PixelOverlayIconProps> = React.memo(({
  sprite,
  size = 32,
  className,
}) => {
  return (
    <PixelGrid
      grid={sprite.grid}
      palette={sprite.palette}
      size={size}
      className={className}
    />
  );
});

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  className?: string;
}

export const PixelIcon: React.FC<PixelIconProps> = React.memo(({
  name,
  size = 16,
  className = '',
}) => {
  const def = PIXEL_ICONS[name];
  return (
    <PixelGrid
      grid={def.grid}
      palette={def.palette}
      size={size}
      className={`pixel-icon-svg ${className}`}
    />
  );
});

interface PixelItemImgProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
}

export const PixelItemImg: React.FC<PixelItemImgProps> = React.memo(({
  src,
  alt = '',
  size = 24,
  className = '',
}) => {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`pixel-art-img ${className}`}
      draggable={false}
    />
  );
});

interface PixelPetSpriteProps {
  species: SpeciesId;
  pose?: PetAnimPose;
  stage?: GrowthStage;
  size?: number;
  flipX?: boolean;
  className?: string;
  useStatic?: boolean;
}

export const PixelPetSprite: React.FC<PixelPetSpriteProps> = ({
  species,
  pose = 'idle0',
  stage = 'baby',
  size = 96,
  flipX = false,
  className = '',
  useStatic = false,
}) => {
  const meta = SPECIES_CATALOG[species];
  const sprite = meta.stageSprites[stage];
  // Both awake and sleep sprites come from unified 44x44 PMDCollab pixel art!
  const src =
    pose === 'sleep'
      ? sprite.sleep
      : useStatic
        ? sprite.static
        : sprite.animated;

  const isSleep = pose === 'sleep';
  const isSad = pose === 'sad';

  return (
    <div
      className={`pixel-pet-wrap ${isSleep ? 'is-sleeping' : ''} ${isSad ? 'is-sad' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        transform: flipX ? 'scaleX(-1)' : undefined,
      }}
    >
      <img
        src={src}
        alt={meta.stageNames[stage]}
        width={size}
        height={size}
        className="pixel-pokemon-img"
        draggable={false}
      />
    </div>
  );
};

interface PixelFillMeterProps {
  name: PixelIconName;
  value: number;
  label: string;
  size?: number;
}

/**
 * Stepped bottom-to-top pixel liquid fill meter icon:
 * renders an empty dark-outlined silhouette below and full-palette rows rising on the 10px grid!
 */
export const PixelFillMeter: React.FC<PixelFillMeterProps> = ({
  name,
  value,
  label,
  size = 15,
}) => {
  const clipId = useId().replace(/:/g, '_');
  const def = PIXEL_ICONS[name];
  const rows = def.grid.length;
  const cols = def.grid[0]?.length ?? 10;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const filledRows = clamped <= 0 ? 0 : Math.max(1, Math.min(rows, Math.round((clamped / 100) * rows)));
  const low = clamped < 28;

  return (
    <div
      className={`pixel-fill-chip ${low ? 'is-low' : ''}`}
      title={`${label}: ${clamped}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${cols} ${rows}`}
        shapeRendering="crispEdges"
        className="pixel-icon-svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y={rows - filledRows} width={cols} height={filledRows} />
          </clipPath>
        </defs>
        {/* Base empty silhouette */}
        {def.grid.map((row, y) =>
          row.split('').map((ch, x) => {
            if (ch === '.') return null;
            const isOutline = ch === 'K';
            return (
              <rect
                key={`bg-${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={isOutline ? '#464154' : '#ded8c8'}
              />
            );
          }),
        )}
        {/* Liquid-filled bottom-to-top active rows */}
        <g clipPath={`url(#${clipId})`}>
          {def.grid.map((row, y) =>
            row.split('').map((ch, x) => {
              if (ch === '.') return null;
              const fill = def.palette[ch];
              if (!fill) return null;
              return <rect key={`fg-${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
            }),
          )}
        </g>
      </svg>
      <span>{clamped}</span>
    </div>
  );
};

interface PixelPetIconProps {
  species: SpeciesId;
  stage?: GrowthStage;
  width?: number;
}

export const PixelPetIcon: React.FC<PixelPetIconProps> = ({
  species,
  stage = 'baby',
  width = 36,
}) => {
  const meta = SPECIES_CATALOG[species];
  const height = Math.round((width * 3) / 4);
  return (
    <img
      src={meta.stageSprites[stage].icon}
      alt={meta.stageNames[stage]}
      width={width}
      height={height}
      className="pixel-art-img"
      draggable={false}
    />
  );
};

interface PixelPetPortraitProps {
  species: SpeciesId;
  stage?: GrowthStage;
  size?: number;
}

export const PixelPetPortrait: React.FC<PixelPetPortraitProps> = ({
  species,
  stage = 'baby',
  size = 52,
}) => {
  const meta = SPECIES_CATALOG[species];
  return (
    <img
      src={meta.stageSprites[stage].portrait}
      alt={meta.stageNames[stage]}
      width={size}
      height={size}
      className="pixel-portrait-img"
      draggable={false}
    />
  );
};

const PETTING_HAND_GRID = [
  '.....KK.KK......',
  '....KWWKWWK.....',
  '....KWWKWWKK....',
  '...KWWWWWWWKK...',
  '..KWWKWWWWWKWK..',
  '..KWWKWWWWWKWK..',
  '.KKWWWWWWWWWWK..',
  'KWWKWWWWWWWWWKK.',
  'KWWKWWWWWWWWWSSK',
  '.KWWWWWWWWWWSSK.',
  '..KWWWWWWWWSSK..',
  '...KWWWWWWSSK...',
  '....KWWWWSSK....',
  '....KRRRRRRK....',
  '....KRRDDRRK....',
  '.....KKKKKK.....',
];

const PETTING_HAND_PALETTE: Record<string, string> = {
  K: '#22202b',
  W: '#fff4e6',
  S: '#f3d0b0',
  R: '#e03131',
  D: '#a61e4d',
};

export const PixelPettingHand: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => (
  <PixelGrid
    grid={PETTING_HAND_GRID}
    palette={PETTING_HAND_PALETTE}
    size={size}
    className={`pixel-petting-hand-svg ${className}`}
  />
);
