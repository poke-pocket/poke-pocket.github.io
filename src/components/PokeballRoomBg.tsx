import React from 'react';
import type { RoomThemeId } from '../types/pet';

interface PokeballRoomBgProps {
  roomId: RoomThemeId;
  isNight: boolean;
}

const INK = '#1c1926';

/**
 * Renders a hand-crafted ASCII pixel-art matrix at (x, y) on our authentic 160x112
 * pixel canvas (1 logical pixel = ~2.8-3px on screen, matching PMD 44x44 sprites!).
 * Zero circles, zero polygons, zero smooth vectors — 100% pure crisp pixel art!
 */
const PixelStamp: React.FC<{
  x: number;
  y: number;
  grid: string[];
  palette: Record<string, string>;
}> = ({ x, y, grid, palette }) => (
  <g transform={`translate(${x}, ${y})`}>
    {grid.map((row, ry) => {
      const rects: React.ReactNode[] = [];
      let rx = 0;
      while (rx < row.length) {
        const ch = row[rx];
        if (ch === '.' || !palette[ch]) {
          rx++;
          continue;
        }
        let end = rx + 1;
        while (end < row.length && row[end] === ch) end++;
        rects.push(
          <rect
            key={`${ry}-${rx}`}
            x={rx}
            y={ry}
            width={end - rx}
            height={1}
            fill={palette[ch]}
          />,
        );
        rx = end;
      }
      return rects;
    })}
  </g>
);

/**
 * Stepped pixel-art checkerboard light halo (NO <circle>!).
 * Classic GBA/SNES Bayer dithered warm lantern/lamp/fire glow.
 */
const PixelDitherGlow: React.FC<{
  cx: number;
  cy: number;
  radius: number;
  color: string;
}> = ({ cx, cy, radius, color }) => {
  const dots: React.ReactNode[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy); // crisp pixel diamond/octagon
      const maxD = Math.max(Math.abs(dx), Math.abs(dy));
      if (maxD > radius || dist > Math.floor(radius * 1.45)) continue;
      const checker = (dx + dy) & 1;
      const sparse = (dx & 1) === 0 && (dy & 1) === 0;
      if (dist <= Math.floor(radius * 0.72) && checker === 0) {
        dots.push(
          <rect key={`${dx},${dy}`} x={cx + dx} y={cy + dy} width={1} height={1} fill={color} opacity={0.28} />,
        );
      } else if (sparse) {
        dots.push(
          <rect key={`${dx},${dy}`} x={cx + dx} y={cy + dy} width={1} height={1} fill={color} opacity={0.18} />,
        );
      }
    }
  }
  return <g>{dots}</g>;
};

// Reusable 160x112 pixel-art furniture stamps
const PLANT_GRID = [
  '....KKKK....',
  '..KKLLLLKK..',
  '.KLLHHLMMMK.',
  '.KLLHMMMMDK.',
  'KLLMLLMDDMDK',
  'KLLMMBMDMDDK',
  '.KMMDMMBDDK.',
  '..KDDKKDDK..',
  '...KKSSKK...',
  '..KPPPPPPK..',
  '..KPHPPPDK..',
  '...KPPPPK...',
  '...KPHPDK...',
  '...KPHPDK...',
  '....KKKK....',
];

const LAMP_GRID = [
  '..KKKKKK..',
  '.KSHHHHKK.',
  'KSHHHLLSSK',
  'KSHHHLLSSK',
  'KKKKKKKKKK',
  '....KK....',
  '...KBBK...',
  '..KBBBBK..',
  '..KKKKKK..',
];

const POKEBALL_DOLL_GRID = [
  '..KKKK..',
  '.KRRRRK.',
  'KRHRRRRK',
  'KKKWWKKK',
  'KWWKKWWK',
  '.KWWWWK.',
  '..KKKK..',
];

const CRESCENT_MOON_GRID = [
  '..KKK..',
  '.KYYYK.',
  'KYYKK..',
  'KYYK...',
  'KYYKK..',
  '.KYYYK.',
  '..KKK..',
];

const CLOUD_GRID = [
  '...WWWW...',
  '.WWWWWWWW.',
  'WWWWWWWWWW',
  '.CCCCCCCC.',
];

const FIRE_GRID = [
  '....OO....',
  '...OYYO...',
  '..OYYYYO..',
  '.OYYWWYYO.',
  '.OYYWWYYO.',
  'OOYWWWWYOO',
  'KBBBBBBBBK',
  'KKKKKKKKKK',
];

const FISH_GRID = [
  '.KKK..K.',
  'KOOKKKOK',
  'KOEOOOOK',
  '.KKK..K.',
];

const HEART_PILLOW_GRID = [
  '.KK.KK.',
  'KPWKPPK',
  'KPPPPPK',
  '.KPPPK.',
  '..KPK..',
  '...K...',
];

const CANDELABRA_GRID = [
  '.G...G...G.',
  'GYG.GYG.GYG',
  '.K...K...K.',
  '.W...W...W.',
  '.W...W...W.',
  '.KKKKKKKKK.',
  '....KDK....',
  '....KDK....',
  '...KDDDK...',
  '..KKKKKKK..',
];

const CRYSTAL_GRID = [
  '...KK...',
  '..KHHK..',
  '.KHMMPK.',
  '.KHMMDK.',
  '.KMMMDK.',
  '..KMDK..',
  '...KK...',
];

const SHELL_LAMP_GRID = [
  '..KKKKKK..',
  '.KPHHHPPK.',
  'KPHKPPKPPK',
  'KPPKPPKDDK',
  '.KPPPPDDK.',
  '..KKKKKK..',
];

const CHANDELIER_GRID = [
  '........KK........',
  '........KK........',
  '..Y.....KK.....Y..',
  '.KYK..Y.KK.Y..KYK.',
  '.KWK.KYKKKKYK.KWK.',
  '.KKKKKKKKKKKKKKKK.',
  '...KGGKGGGGKGGK...',
  '.....KKKKKKKK.....',
];

const PokeballBeltAndClasp: React.FC<{
  beltColor?: string;
  trimColor?: string;
  coreColor: string;
  glowColor: string;
}> = ({ beltColor = INK, trimColor = '#3a374a', coreColor, glowColor }) => (
  <g>
    <rect x="0" y="34" width="160" height="5" fill={beltColor} />
    <rect x="0" y="35" width="160" height="1" fill={trimColor} />
    {/* Stepped pixel octagonal center clasp */}
    <rect x="72" y="30" width="16" height="13" fill={beltColor} />
    <rect x="70" y="32" width="20" height="9" fill={beltColor} />
    <rect x="73" y="31" width="14" height="11" fill="#c7d0df" />
    <rect x="74" y="32" width="12" height="9" fill="#eef3fa" />
    <rect x="75" y="33" width="10" height="7" fill={beltColor} />
    <rect x="76" y="34" width="8" height="5" fill={coreColor} />
    <rect x="77" y="34" width="3" height="2" fill={glowColor} />
  </g>
);

/** Authentic pixel wood-plank floor with 1px grain highlights & staggered plank seams */
const PixelWoodFloor: React.FC<{
  yStart: number;
  base: string;
  alt: string;
  hi: string;
  grout: string;
}> = ({ yStart, base, alt, hi, grout }) => (
  <g>
    <rect x="0" y={yStart} width="160" height={112 - yStart} fill={base} />
    <rect x="0" y={yStart} width="160" height="2" fill={INK} />
    {[0, 1, 2, 3, 4].map((row) => {
      const y = yStart + 2 + row * 7;
      const offset = (row % 2) * 16;
      return (
        <g key={row}>
          {row % 2 === 1 && <rect x="0" y={y} width="160" height="6" fill={alt} />}
          <rect x="0" y={y} width="160" height="1" fill={hi} opacity={0.45} />
          <rect x="0" y={y + 6} width="160" height="1" fill={grout} />
          {[0, 32, 64, 96, 128].map((sx) => {
            const x = (sx + offset) % 160;
            return (
              <g key={sx}>
                <rect x={x} y={y} width="1" height="6" fill={grout} />
                {/* 2px wood grain knot */}
                <rect x={(x + 11) % 158} y={y + 3} width="3" height="1" fill={grout} opacity={0.55} />
              </g>
            );
          })}
        </g>
      );
    })}
  </g>
);

/** Authentic pixel checkered tile floor with bevel highlights */
const PixelTileFloor: React.FC<{
  yStart: number;
  c1: string;
  c2: string;
  hi: string;
  grout: string;
}> = ({ yStart, c1, c2, hi, grout }) => (
  <g>
    <rect x="0" y={yStart} width="160" height={112 - yStart} fill={grout} />
    <rect x="0" y={yStart} width="160" height="2" fill={INK} />
    {[0, 1, 2, 3].map((row) =>
      Array.from({ length: 10 }).map((_, col) => {
        const alt = (row + col) % 2 === 0;
        const tx = col * 16;
        const ty = yStart + 2 + row * 9;
        return (
          <g key={`${row}-${col}`}>
            <rect x={tx} y={ty} width="15" height="8" fill={alt ? c1 : c2} />
            <rect x={tx} y={ty} width="15" height="1" fill={hi} opacity={alt ? 0.3 : 0.14} />
          </g>
        );
      }),
    )}
  </g>
);

/** Stepped pixel woven rug with pixel border stitching & fringe tassels */
const PixelRug: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  outer: string;
  inner: string;
  stripe: string;
  fringe: string;
}> = ({ x, y, w, h, outer, inner, stripe, fringe }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={INK} />
    <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={outer} />
    <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill={inner} />
    <rect x={x + 4} y={y + 4} width={w - 8} height={2} fill={stripe} />
    <rect x={x + 4} y={y + h - 6} width={w - 8} height={2} fill={stripe} />
    {/* Pixel center emblem diamond */}
    <rect x={x + Math.floor(w / 2) - 4} y={y + Math.floor(h / 2) - 2} width={8} height={4} fill={stripe} opacity={0.65} />
    <rect x={x + Math.floor(w / 2) - 2} y={y + Math.floor(h / 2) - 3} width={4} height={6} fill={stripe} opacity={0.65} />
    {/* Stepped pixel fringes */}
    {Array.from({ length: Math.floor((h - 2) / 3) }).map((_, i) => {
      const fy = y + 2 + i * 3;
      return (
        <React.Fragment key={i}>
          <rect x={x - 2} y={fy} width="2" height="1" fill={fringe} />
          <rect x={x + w} y={fy} width="2" height="1" fill={fringe} />
        </React.Fragment>
      );
    })}
  </g>
);

/** Stepped pixel sunlit window beam (ZERO smooth <polygon>!) */
const PixelSunbeam: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g opacity={0.22}>
    {[0, 1, 2, 3, 4, 5, 6, 7].map((step) => (
      <rect
        key={step}
        x={x + step * 2}
        y={y + step * 2}
        width={22}
        height={2}
        fill={color}
      />
    ))}
  </g>
);

/**
 * Pure 160x112 16-bit GBA Secret-Base pixel-art SVG interiors for all 9 Pokeball rooms!
 */
export const PokeballRoomBg: React.FC<PokeballRoomBgProps> = ({ roomId, isNight }) => {
  // 1. CLASSIC POKEBALL ROOM
  if (roomId === 'pokeball_room') {
    const wall = isNight ? '#1b2234' : '#f7f1e3';
    const wallStripe = isNight ? '#161c2c' : '#eee5d0';
    const wainscot = isNight ? '#262f47' : '#dfd2ba';
    const dome = isNight ? '#82282e' : '#de4848';
    const domeDark = isNight ? '#5c1a1f' : '#b52f35';
    const domeHi = isNight ? '#a33a41' : '#f57676';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={wallStripe} />
        ))}
        <rect x="0" y="65" width="160" height="2" fill={isNight ? '#35405e' : '#c4b393'} />
        <rect x="0" y="67" width="160" height="11" fill={wainscot} />

        {/* Stepped Red Pokeball Dome */}
        <rect x="0" y="0" width="160" height="12" fill={domeDark} />
        <rect x="0" y="12" width="160" height="11" fill={dome} />
        <rect x="14" y="4" width="132" height="3" fill={domeHi} />
        <rect x="0" y="23" width="22" height="6" fill={dome} />
        <rect x="138" y="23" width="22" height="6" fill={dome} />
        <rect x="0" y="29" width="10" height="6" fill={dome} />
        <rect x="150" y="29" width="10" height="6" fill={dome} />

        <PokeballBeltAndClasp
          coreColor={isNight ? '#5d6e8f' : '#dbe3f0'}
          glowColor={isNight ? '#90e0ef' : '#ffffff'}
        />

        {/* Pixel Window + Curtains */}
        <rect x="11" y="41" width="26" height="22" fill={INK} />
        <rect x="12" y="42" width="24" height="20" fill={isNight ? '#0e1526' : '#74c0fc'} />
        {isNight ? (
          <>
            <rect x="12" y="55" width="24" height="7" fill="#18223d" />
            <PixelStamp x={27} y={44} grid={CRESCENT_MOON_GRID} palette={{ K: '#18223d', Y: '#ffe066' }} />
            <rect x="15" y="45" width="1" height="1" fill="#fff3bf" />
            <rect x="21" y="49" width="1" height="1" fill="#ffe066" />
            <rect x="18" y="44" width="1" height="1" fill="#ffffff" />
          </>
        ) : (
          <>
            <rect x="12" y="55" width="24" height="7" fill="#a5d8ff" />
            <PixelStamp x={14} y={44} grid={CLOUD_GRID} palette={{ W: '#ffffff', C: '#d0ebff' }} />
            <PixelStamp x={24} y={49} grid={CLOUD_GRID} palette={{ W: '#ffffff', C: '#d0ebff' }} />
          </>
        )}
        <rect x="23" y="42" width="1" height="20" fill={INK} />
        <rect x="12" y="51" width="24" height="1" fill={INK} />
        <rect x="10" y="39" width="28" height="2" fill="#7d4925" />
        <rect x="10" y="41" width="4" height="21" fill={isNight ? '#6e2831' : '#d94848'} />
        <rect x="11" y="41" width="1" height="21" fill={isNight ? '#963b47' : '#ff8787'} />
        <rect x="34" y="41" width="4" height="21" fill={isNight ? '#6e2831' : '#d94848'} />
        <rect x="35" y="41" width="1" height="21" fill={isNight ? '#963b47' : '#ff8787'} />

        {/* Pixel Wall Clock (Above Nightstand) */}
        <rect x="50" y="42" width="8" height="8" fill={INK} />
        <rect x="51" y="43" width="6" height="6" fill="#fffdf5" />
        <rect x="53" y="44" width="1" height="3" fill={INK} />
        <rect x="54" y="46" width="2" height="1" fill="#e03131" />

        {/* Pixel Kanto Map Poster */}
        <rect x="91" y="44" width="16" height="13" fill={INK} />
        <rect x="92" y="45" width="14" height="11" fill="#fff9db" />
        <rect x="93" y="46" width="6" height="5" fill="#69db7c" />
        <rect x="99" y="48" width="6" height="7" fill="#4dabf7" />
        <rect x="94" y="52" width="5" height="3" fill="#ffc078" />
        <rect x="98" y="43" width="2" height="1" fill={INK} />
        {/* Tiny Pixel Hanging Pennant next to Poster */}
        <rect x="64" y="45" width="9" height="9" fill={INK} />
        <rect x="65" y="46" width="7" height="7" fill="#ffe066" />
        <rect x="67" y="48" width="3" height="3" fill="#e03131" />

        {/* Wooden Pixel Bookshelf */}
        <rect x="112" y="43" width="26" height="35" fill={INK} />
        <rect x="113" y="44" width="24" height="33" fill="#6e3f22" />
        <rect x="115" y="46" width="20" height="8" fill="#452512" />
        <rect x="115" y="56" width="20" height="8" fill="#452512" />
        <rect x="115" y="66" width="20" height="9" fill="#452512" />
        {/* Shelf 1 Books */}
        <rect x="116" y="47" width="2" height="7" fill="#ff6b6b" />
        <rect x="119" y="48" width="2" height="6" fill="#4dabf7" />
        <rect x="122" y="47" width="2" height="7" fill="#ffd43b" />
        <rect x="125" y="48" width="2" height="6" fill="#69db7c" />
        <rect x="130" y="48" width="4" height="6" fill="#e64980" />
        <rect x="131" y="47" width="2" height="1" fill="#ffe066" />
        {/* Shelf 2 Books + Mini Pokeball */}
        <rect x="116" y="57" width="3" height="7" fill="#9775fa" />
        <rect x="120" y="58" width="2" height="6" fill="#ffa94d" />
        <PixelStamp
          x={127}
          y={57}
          grid={POKEBALL_DOLL_GRID}
          palette={{ K: INK, R: '#f03e3e', H: '#ffa8a8', W: '#ffffff' }}
        />
        {/* Shelf 3 Storage Boxes */}
        <rect x="116" y="68" width="8" height="7" fill="#d9a066" />
        <rect x="118" y="70" width="4" height="1" fill="#7d4925" />
        <rect x="126" y="68" width="8" height="7" fill="#b87c4c" />
        <rect x="128" y="70" width="4" height="1" fill="#5c3317" />

        {/* Nightstand + Pixel Table Lamp + Checkerboard Dither Glow (NO CIRCLE!) */}
        <rect x="46" y="64" width="14" height="14" fill={INK} />
        <rect x="47" y="65" width="12" height="12" fill="#8c5230" />
        <rect x="48" y="66" width="10" height="4" fill="#a86942" />
        <rect x="52" y="67" width="2" height="1" fill="#ffe066" />
        <rect x="48" y="71" width="10" height="5" fill="#784324" />
        {isNight && <PixelDitherGlow cx={53} cy={58} radius={11} color="#ffe066" />}
        <PixelStamp
          x={48}
          y={55}
          grid={LAMP_GRID}
          palette={{
            K: INK,
            H: isNight ? '#fff3bf' : '#fff9db',
            L: isNight ? '#ffd43b' : '#ffe066',
            S: isNight ? '#f59f00' : '#fab005',
            B: '#5c3d2e',
          }}
        />

        {/* Tufted Coral Pixel Sofa */}
        <rect x="6" y="64" width="37" height="14" fill={INK} />
        <rect x="7" y="65" width="35" height="7" fill={isNight ? '#7a333c' : '#e06669'} />
        <rect x="8" y="66" width="33" height="2" fill={isNight ? '#9c4550' : '#ff999c'} />
        <rect x="7" y="69" width="5" height="8" fill={isNight ? '#5e232a' : '#c44b4e'} />
        <rect x="37" y="69" width="5" height="8" fill={isNight ? '#5e232a' : '#c44b4e'} />
        <rect x="12" y="71" width="25" height="6" fill={isNight ? '#8f3f48' : '#f28482'} />
        <rect x="24" y="71" width="1" height="6" fill={INK} />
        <rect x="14" y="68" width="5" height="4" fill="#ffd43b" />
        <rect x="15" y="69" width="2" height="1" fill="#fff3bf" />

        {/* Potted Pixel Plant */}
        <PixelStamp
          x={142}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: isNight ? '#2b7a4b' : '#40c057',
            H: isNight ? '#409964' : '#8ce99a',
            M: isNight ? '#1f5e39' : '#2f9e44',
            D: isNight ? '#154227' : '#237a35',
            B: isNight ? '#1f5e39' : '#2f9e44',
            S: '#6e3f22',
            P: '#b85d38',
          }}
        />

        <PixelWoodFloor
          yStart={78}
          base={isNight ? '#242b3d' : '#dec9ae'}
          alt={isNight ? '#1f2536' : '#d2ba9b'}
          hi={isNight ? '#343f59' : '#f0e2ce'}
          grout={isNight ? '#161b29' : '#b89d7c'}
        />
        {!isNight && <PixelSunbeam x={12} y={80} color="#fff9db" />}
        <PixelRug
          x={43}
          y={83}
          w={74}
          h={17}
          outer={isNight ? '#2f3a54' : '#f5f0e4'}
          inner={isNight ? '#263047' : '#ebe3d3'}
          stripe={isNight ? '#963b42' : '#e04f56'}
          fringe={isNight ? '#596682' : '#e0d6c3'}
        />
        {/* Cozy Floor Berry Bowl (Left of Rug) & Pixel Slipper Mat (Right) */}
        <rect x="20" y="92" width="12" height="6" fill={INK} />
        <rect x="21" y="94" width="10" height="3" fill="#e04f56" />
        <rect x="22" y="91" width="3" height="3" fill="#4dabf7" />
        <rect x="25" y="90" width="3" height="4" fill="#ffd43b" />
        <rect x="28" y="91" width="2" height="3" fill="#ff8787" />
        {/* Mini Pixel Cushion Stool (Right of Rug) */}
        <rect x="128" y="88" width="14" height="9" fill={INK} />
        <rect x="129" y="89" width="12" height="5" fill={isNight ? '#3c527a' : '#74c0fc'} />
        <rect x="131" y="90" width="8" height="2" fill={isNight ? '#5c78a8' : '#d0ebff'} />
        <rect x="129" y="94" width="12" height="2" fill={isNight ? '#293957' : '#339af0'} />
      </svg>
    );
  }

  // 2. HEAL BALL ROOM (樱粉甜品屋)
  if (roomId === 'healball_room') {
    const wall = isNight ? '#2b192d' : '#fff0f6';
    const stripe = isNight ? '#241426' : '#ffe3ee';
    const dome = isNight ? '#9c366d' : '#f783ac';
    const domeDark = isNight ? '#70224c' : '#e64980';
    const mint = isNight ? '#2d7a72' : '#63e6be';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill={isNight ? '#38213b' : '#fcc2d7'} />

        {/* Heal Ball Pink Dome with Yellow & Mint Accent Bands */}
        <rect x="0" y="0" width="160" height="11" fill={domeDark} />
        <rect x="0" y="11" width="160" height="12" fill={dome} />
        <rect x="20" y="5" width="24" height="18" fill={isNight ? '#9c8326' : '#ffe066'} />
        <rect x="116" y="5" width="24" height="18" fill={isNight ? '#9c8326' : '#ffe066'} />
        <rect x="64" y="4" width="32" height="19" fill={mint} />
        <rect x="0" y="23" width="22" height="11" fill={dome} />
        <rect x="138" y="23" width="22" height="11" fill={dome} />

        <PokeballBeltAndClasp beltColor="#47213b" trimColor="#80406a" coreColor="#ffe066" glowColor="#ffffff" />

        {/* Sakura Blossom Window (Left) */}
        <rect x="11" y="41" width="26" height="22" fill={INK} />
        <rect x="12" y="42" width="24" height="20" fill={isNight ? '#1d1433' : '#d0ebff'} />
        {/* Pixel Sakura Branch inside Window */}
        <rect x="12" y="48" width="14" height="2" fill="#6e3f22" />
        <rect x="15" y="45" width="5" height="4" fill="#faa2c1" />
        <rect x="21" y="47" width="5" height="4" fill="#ffdeeb" />
        <rect x="28" y="52" width="2" height="2" fill="#faa2c1" />
        <rect x="23" y="42" width="1" height="20" fill={INK} />
        <rect x="12" y="51" width="24" height="1" fill={INK} />
        <rect x="10" y="41" width="4" height="21" fill={mint} />
        <rect x="34" y="41" width="4" height="21" fill={mint} />

        {/* Pastel Candy & Macaron Shelf (Right) */}
        <rect x="112" y="44" width="26" height="34" fill={INK} />
        <rect x="113" y="45" width="24" height="32" fill="#ffffff" />
        <rect x="115" y="47" width="20" height="8" fill="#ffdeeb" />
        <rect x="115" y="57" width="20" height="8" fill="#ffdeeb" />
        <rect x="115" y="67" width="20" height="8" fill="#ffdeeb" />
        {/* Candy Jars */}
        <rect x="117" y="49" width="4" height="6" fill="#ff8787" />
        <rect x="123" y="49" width="4" height="6" fill="#63e6be" />
        <rect x="129" y="49" width="4" height="6" fill="#ffd43b" />
        {/* Macaron Cake Stack */}
        <rect x="118" y="60" width="6" height="5" fill="#f783ac" />
        <rect x="119" y="59" width="4" height="1" fill="#ffffff" />
        <PixelStamp x={127} y={58} grid={HEART_PILLOW_GRID} palette={{ K: INK, P: '#e64980', W: '#ffdeeb' }} />
        <rect x="117" y="69" width="16" height="6" fill="#fcc2d7" />

        {/* Plush Pink Daybed with Heart Pillow */}
        <rect x="8" y="64" width="42" height="14" fill={INK} />
        <rect x="9" y="65" width="40" height="12" fill={isNight ? '#822c55' : '#faa2c1'} />
        <rect x="10" y="66" width="38" height="3" fill={isNight ? '#a63f70' : '#ffdeeb'} />
        <PixelStamp x={24} y={66} grid={HEART_PILLOW_GRID} palette={{ K: INK, P: '#ffe066', W: '#ffffff' }} />

        {/* Heart Lamp + Dither Glow */}
        <rect x="54" y="67" width="12" height="11" fill={INK} />
        <rect x="55" y="68" width="10" height="9" fill="#f8f0fc" />
        {isNight && <PixelDitherGlow cx={60} cy={61} radius={10} color="#ffdeeb" />}
        <PixelStamp
          x={55}
          y={58}
          grid={LAMP_GRID}
          palette={{ K: INK, H: '#fff0f6', L: '#faa2c1', S: '#e64980', B: '#c2255c' }}
        />

        {/* Sakura Bonsai Plant */}
        <PixelStamp
          x={142}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: '#faa2c1',
            H: '#ffdeeb',
            M: '#e64980',
            D: '#a61e4d',
            B: '#ffe066',
            S: '#7d4925',
            P: '#63e6be',
          }}
        />

        <PixelTileFloor
          yStart={78}
          c1={isNight ? '#361f38' : '#fff0f6'}
          c2={isNight ? '#2a182c' : '#ffe3ee'}
          hi="#ffffff"
          grout={isNight ? '#1f1021' : '#f3c4d7'}
        />
        <PixelRug
          x={42}
          y={83}
          w={76}
          h={17}
          outer={isNight ? '#822c55' : '#f783ac'}
          inner={isNight ? '#3d1c36' : '#fff9db'}
          stripe={mint}
          fringe="#ffdeeb"
        />
      </svg>
    );
  }

  // 3. GREAT BALL ROOM (蓝调水族房)
  if (roomId === 'greatball_room') {
    const wall = isNight ? '#141e36' : '#d8edff';
    const stripe = isNight ? '#10182b' : '#c9e3fc';
    const dome = isNight ? '#1e428a' : '#2a75eb';
    const domeDark = isNight ? '#142d61' : '#1a53b8';
    const redWing = isNight ? '#9c2735' : '#ed4556';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill={isNight ? '#1a2847' : '#b7d7f7'} />

        {/* Great Ball Blue Dome + Red Stepped Fins */}
        <rect x="0" y="0" width="160" height="13" fill={domeDark} />
        <rect x="0" y="13" width="160" height="11" fill={dome} />
        <rect x="0" y="24" width="26" height="10" fill={dome} />
        <rect x="134" y="24" width="26" height="10" fill={dome} />
        <rect x="9" y="6" width="19" height="6" fill={redWing} />
        <rect x="15" y="12" width="17" height="6" fill={redWing} />
        <rect x="21" y="18" width="14" height="6" fill={redWing} />
        <rect x="132" y="6" width="19" height="6" fill={redWing} />
        <rect x="128" y="12" width="17" height="6" fill={redWing} />
        <rect x="125" y="18" width="14" height="6" fill={redWing} />

        <PokeballBeltAndClasp coreColor={isNight ? '#4cc9f0' : '#ffffff'} glowColor="#d0ebff" />

        {/* Pixel Coral Aquarium (Left) */}
        <rect x="7" y="44" width="38" height="22" fill={INK} />
        <rect x="8" y="45" width="36" height="20" fill={isNight ? '#0a3357' : '#339af0'} />
        <rect x="8" y="45" width="36" height="4" fill={isNight ? '#145388' : '#74c0fc'} />
        <rect x="8" y="61" width="36" height="4" fill="#e9d8a6" />
        {/* Pixel Kelp & Fish */}
        <rect x="12" y="53" width="2" height="8" fill="#2b8a3e" />
        <rect x="14" y="51" width="1" height="8" fill="#40c057" />
        <rect x="35" y="52" width="2" height="9" fill="#2b8a3e" />
        <PixelStamp x={18} y={51} grid={FISH_GRID} palette={{ K: INK, O: '#ff922b', E: '#ffffff' }} />
        <PixelStamp x={27} y={47} grid={FISH_GRID} palette={{ K: INK, O: '#ff85a1', E: '#ffffff' }} />
        <rect x="8" y="66" width="36" height="12" fill={INK} />
        <rect x="9" y="67" width="16" height="10" fill="#3b5bdb" />
        <rect x="27" y="67" width="16" height="10" fill="#3b5bdb" />
        <rect x="23" y="70" width="1" height="3" fill="#ffe066" />
        <rect x="28" y="70" width="1" height="3" fill="#ffe066" />

        {/* Beach Poster + Blue Puff Cushion */}
        <rect x="50" y="45" width="17" height="13" fill={INK} />
        <rect x="51" y="46" width="15" height="6" fill="#74c0fc" />
        <rect x="51" y="52" width="15" height="5" fill="#228be6" />
        <rect x="54" y="47" width="3" height="3" fill="#ffe066" />
        <rect x="49" y="68" width="19" height="10" fill={INK} />
        <rect x="50" y="67" width="17" height="10" fill="#4dabf7" />
        <rect x="52" y="68" width="8" height="3" fill="#a5d8ff" />

        {/* Retro CRT Pixel TV (Right) */}
        <rect x="105" y="64" width="29" height="14" fill={INK} />
        <rect x="106" y="65" width="27" height="12" fill="#495057" />
        <rect x="108" y="67" width="11" height="4" fill="#212529" />
        <rect x="122" y="68" width="8" height="3" fill="#adb5bd" />
        <rect x="108" y="47" width="23" height="17" fill={INK} />
        <rect x="109" y="48" width="21" height="15" fill="#868e96" />
        <rect x="111" y="50" width="17" height="11" fill={INK} />
        <rect x="112" y="51" width="15" height="9" fill={isNight ? '#194a7a' : '#74c0fc'} />
        <rect x="112" y="57" width="15" height="3" fill="#51cf66" />
        <rect x="117" y="53" width="4" height="4" fill="#ffd43b" />
        <rect x="116" y="43" width="1" height="4" fill={INK} />
        <rect x="122" y="43" width="1" height="4" fill={INK} />

        {/* Berry Plant */}
        <PixelStamp
          x={140}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: isNight ? '#2b7a4b' : '#40c057',
            H: isNight ? '#409964' : '#8ce99a',
            M: isNight ? '#1f5e39' : '#2f9e44',
            D: isNight ? '#154227' : '#237a35',
            B: '#ff6b6b',
            S: '#6e3f22',
            P: '#3b7dd8',
          }}
        />

        <PixelTileFloor
          yStart={78}
          c1={isNight ? '#1d2d52' : '#d6e9fc'}
          c2={isNight ? '#162340' : '#b8d6f7'}
          hi="#ffffff"
          grout={isNight ? '#111a33' : '#9cc3eb'}
        />
        <PixelRug
          x={38}
          y={83}
          w={84}
          h={17}
          outer={isNight ? '#1c3e82' : '#339af0'}
          inner={isNight ? '#142a59' : '#e7f5ff'}
          stripe="#ff6b6b"
          fringe="#a5d8ff"
        />
      </svg>
    );
  }

  // 4. NEST BALL ROOM (森林树屋舱)
  if (roomId === 'nestball_room') {
    const wall = isNight ? '#18291d' : '#f2f7e4';
    const plank = isNight ? '#132117' : '#e5efd1';
    const dome = isNight ? '#225930' : '#37b24d';
    const domeDark = isNight ? '#173d21' : '#2b8a3e';
    const goldBand = isNight ? '#8c6d1f' : '#fcc419';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="0" y={38 + i * 5} width="160" height="1" fill={plank} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill={isNight ? '#293b25' : '#c8dba4'} />

        {/* Nest Ball Leafy Green & Gold Stripe Dome */}
        <rect x="0" y="0" width="160" height="11" fill={domeDark} />
        <rect x="0" y="11" width="160" height="12" fill={dome} />
        <rect x="0" y="17" width="160" height="3" fill={goldBand} />
        <rect x="0" y="23" width="24" height="11" fill={dome} />
        <rect x="136" y="23" width="24" height="11" fill={dome} />

        <PokeballBeltAndClasp beltColor="#3b2616" trimColor="#694529" coreColor="#d8f5a2" glowColor="#ffffff" />

        {/* Forest Canopy Window (Left) */}
        <rect x="11" y="41" width="28" height="22" fill={INK} />
        <rect x="12" y="42" width="26" height="20" fill={isNight ? '#0f1f1c' : '#8ce99a'} />
        <rect x="12" y="42" width="26" height="9" fill={isNight ? '#17332a' : '#b2f2bb'} />
        {/* Pixel Pine Trees Outside */}
        <rect x="16" y="50" width="6" height="10" fill="#2b8a3e" />
        <rect x="18" y="47" width="2" height="3" fill="#2b8a3e" />
        <rect x="27" y="52" width="6" height="8" fill="#237a35" />
        <rect x="29" y="49" width="2" height="3" fill="#237a35" />
        <rect x="24" y="42" width="2" height="20" fill="#5c381f" />
        <rect x="12" y="51" width="26" height="2" fill="#5c381f" />

        {/* Tree Stump Table + Lantern */}
        <rect x="46" y="65" width="18" height="13" fill={INK} />
        <rect x="47" y="66" width="16" height="3" fill="#e8c391" />
        <rect x="48" y="69" width="14" height="8" fill="#7d4925" />
        <rect x="51" y="70" width="2" height="7" fill="#5c3317" />
        {isNight && <PixelDitherGlow cx={55} cy={59} radius={10} color="#ffe066" />}
        <PixelStamp
          x={50}
          y={56}
          grid={LAMP_GRID}
          palette={{ K: INK, H: '#fff9db', L: '#ffd43b', S: '#e67700', B: '#4a2e16' }}
        />

        {/* Mossy Log Bench */}
        <rect x="8" y="67" width="34" height="11" fill={INK} />
        <rect x="9" y="68" width="32" height="9" fill="#8c5230" />
        <rect x="9" y="68" width="32" height="3" fill="#51cf66" />
        <rect x="13" y="68" width="4" height="1" fill="#b2f2bb" />
        <rect x="28" y="68" width="5" height="1" fill="#b2f2bb" />

        {/* Wooden Berry Crate Shelf (Right) */}
        <rect x="108" y="46" width="28" height="32" fill={INK} />
        <rect x="109" y="47" width="26" height="30" fill="#7d4925" />
        <rect x="111" y="49" width="22" height="11" fill="#4f2c15" />
        <rect x="111" y="63" width="22" height="12" fill="#4f2c15" />
        {/* Colorful Berries on Shelf */}
        <rect x="113" y="54" width="4" height="5" fill="#4dabf7" />
        <rect x="119" y="54" width="4" height="5" fill="#ffd43b" />
        <rect x="125" y="54" width="4" height="5" fill="#ff8787" />
        <rect x="113" y="68" width="9" height="6" fill="#d9a066" />
        <rect x="124" y="68" width="8" height="6" fill="#69db7c" />

        {/* Double Potted Berry Trees */}
        <PixelStamp
          x={142}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: '#51cf66',
            H: '#b2f2bb',
            M: '#2f9e44',
            D: '#1e6e2d',
            B: '#ffd43b',
            S: '#5c3317',
            P: '#a6673f',
          }}
        />

        <PixelWoodFloor
          yStart={78}
          base={isNight ? '#233622' : '#b7d48c'}
          alt={isNight ? '#1c2b1b' : '#a8c77b'}
          hi={isNight ? '#354f34' : '#d8f5a2'}
          grout={isNight ? '#131f13' : '#85a658'}
        />
        {!isNight && <PixelSunbeam x={12} y={80} color="#fff9db" />}
        <PixelRug
          x={42}
          y={83}
          w={76}
          h={17}
          outer={isNight ? '#2b5e36' : '#51cf66'}
          inner={isNight ? '#1e4226' : '#d8f5a2'}
          stripe="#fcc419"
          fringe="#e9fac8"
        />
      </svg>
    );
  }

  // 5. DIVE BALL ROOM (珊瑚海底舱)
  if (roomId === 'diveball_room') {
    const wall = isNight ? '#0a2036' : '#c5f0ff';
    const stripe = isNight ? '#081a2c' : '#b3e7fc';
    const dome = isNight ? '#145285' : '#22b8cf';
    const domeDark = isNight ? '#0c375c' : '#1098ad';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill={isNight ? '#11304d' : '#99e2fa'} />

        {/* Dive Ball Ocean Gradient Stepped Dome */}
        <rect x="0" y="0" width="160" height="10" fill={domeDark} />
        <rect x="0" y="10" width="160" height="12" fill={dome} />
        <rect x="20" y="16" width="120" height="4" fill={isNight ? '#2a7599' : '#e3fafc'} />
        <rect x="0" y="22" width="24" height="12" fill={dome} />
        <rect x="136" y="22" width="24" height="12" fill={dome} />

        <PokeballBeltAndClasp beltColor="#0b2842" trimColor="#3bc9db" coreColor="#e3fafc" glowColor="#ffffff" />

        {/* Twin Deep-Sea Submarine Portholes (Stepped Octagon, ZERO <circle>!) */}
        {[14, 114].map((px, idx) => (
          <g key={px}>
            <rect x={px + 3} y="41" width="22" height="22" fill={INK} />
            <rect x={px} y="44" width="28" height="16" fill={INK} />
            <rect x={px + 4} y="42" width="20" height="20" fill="#74c0fc" />
            <rect x={px + 1} y="45" width="26" height="14" fill="#74c0fc" />
            <rect x={px + 5} y="43" width="18" height="18" fill={isNight ? '#08223d' : '#1c7ed6'} />
            <rect x={px + 2} y="46" width="24" height="12" fill={isNight ? '#08223d' : '#1c7ed6'} />
            {/* Underwater Bubbles + Fish + Coral */}
            <rect x={px + 6} y="56" width="3" height="5" fill="#ff6b6b" />
            <rect x={px + 18} y="55" width="4" height="6" fill="#51cf66" />
            <rect x={px + 8} y="46" width="2" height="2" fill="#e3fafc" />
            <rect x={px + 19} y="48" width="1" height="1" fill="#e3fafc" />
            <PixelStamp
              x={px + (idx === 0 ? 10 : 9)}
              y={49}
              grid={FISH_GRID}
              palette={{ K: INK, O: idx === 0 ? '#ffd43b' : '#ff8787', E: '#ffffff' }}
            />
          </g>
        ))}

        {/* Pearl Shell Nightstand & Glowing Shell Lamp */}
        <rect x="48" y="66" width="16" height="12" fill={INK} />
        <rect x="49" y="67" width="14" height="10" fill="#3bc9db" />
        <rect x="51" y="69" width="10" height="3" fill="#99e9f2" />
        {isNight && <PixelDitherGlow cx={56} cy={61} radius={10} color="#99e9f2" />}
        <PixelStamp
          x={51}
          y={60}
          grid={SHELL_LAMP_GRID}
          palette={{ K: INK, P: '#fcc2d7', H: '#fff0f6', D: '#e64980' }}
        />

        {/* Driftwood Treasure Chest (Right) */}
        <rect x="92" y="66" width="18" height="12" fill={INK} />
        <rect x="93" y="67" width="16" height="4" fill="#a6673f" />
        <rect x="93" y="71" width="16" height="6" fill="#7d4925" />
        <rect x="99" y="70" width="4" height="3" fill="#ffd43b" />

        {/* Seaweed Coral Planter */}
        <PixelStamp
          x={144}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: '#3bc9db',
            H: '#99e9f2',
            M: '#15aabf',
            D: '#0b7285',
            B: '#ff8787',
            S: '#0b7285',
            P: '#f783ac',
          }}
        />

        <PixelTileFloor
          yStart={78}
          c1={isNight ? '#0e2c4a' : '#a5f3fc'}
          c2={isNight ? '#0a2138' : '#74c0fc'}
          hi="#ffffff"
          grout={isNight ? '#071729' : '#4dabf7'}
        />
        <PixelRug
          x={40}
          y={83}
          w={80}
          h={17}
          outer={isNight ? '#0c4a6e' : '#15aabf'}
          inner={isNight ? '#082f49' : '#e3fafc'}
          stripe="#ff8787"
          fringe="#c5f6fa"
        />
      </svg>
    );
  }

  // 6. ULTRA BALL ROOM (黑金壁炉沙龙)
  if (roomId === 'ultraball_room') {
    const wall = isNight ? '#15131c' : '#2c2836';
    const stripe = isNight ? '#100f16' : '#24202d';
    const dome = '#181620';
    const gold = '#f5b700';
    const goldHi = '#ffe066';
    const goldDark = '#b88200';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="67" width="160" height="11" fill="#1b1822" />

        {/* Ultra Ball Charcoal Dome + Sculpted Gold H-Beams */}
        <rect x="0" y="0" width="160" height="22" fill={dome} />
        <rect x="21" y="5" width="12" height="30" fill={goldDark} />
        <rect x="22" y="5" width="10" height="30" fill={gold} />
        <rect x="24" y="6" width="3" height="28" fill={goldHi} />
        <rect x="127" y="5" width="12" height="30" fill={goldDark} />
        <rect x="128" y="5" width="10" height="30" fill={gold} />
        <rect x="130" y="6" width="3" height="28" fill={goldHi} />
        <rect x="33" y="5" width="94" height="7" fill={gold} />
        <rect x="33" y="5" width="94" height="2" fill={goldHi} />

        <PokeballBeltAndClasp beltColor="#0e0d12" trimColor="#383345" coreColor={goldHi} glowColor="#ffffff" />

        {/* Tufted Burgundy Velvet Sofa (Left) */}
        <rect x="6" y="62" width="42" height="16" fill={INK} />
        <rect x="7" y="63" width="40" height="8" fill="#7d1c30" />
        <rect x="9" y="64" width="36" height="2" fill="#a62c44" />
        <rect x="14" y="66" width="2" height="2" fill={gold} />
        <rect x="26" y="66" width="2" height="2" fill={gold} />
        <rect x="38" y="66" width="2" height="2" fill={gold} />
        <rect x="7" y="69" width="6" height="8" fill="#5e1322" />
        <rect x="41" y="69" width="6" height="8" fill="#5e1322" />
        <rect x="13" y="70" width="28" height="7" fill="#99243b" />
        {/* Brass Pixel Wall Sconce + Dither Glow (NO CIRCLE!) */}
        <PixelDitherGlow cx={27} cy={49} radius={9} color="#ffd43b" />
        <rect x="24" y="46" width="6" height="6" fill={INK} />
        <rect x="25" y="47" width="4" height="4" fill={goldHi} />

        {/* Brick & Marble Hearth Fireplace (Center) */}
        <rect x="57" y="49" width="28" height="29" fill={INK} />
        <rect x="58" y="50" width="26" height="27" fill="#4f4654" />
        {/* Brick Grout Lines */}
        <rect x="58" y="54" width="26" height="1" fill="#3a333f" />
        <rect x="58" y="59" width="26" height="1" fill="#3a333f" />
        <rect x="56" y="48" width="30" height="3" fill="#6b5e4c" />
        <rect x="68" y="42" width="6" height="6" fill={gold} />
        <rect x="70" y="44" width="2" height="2" fill="#fff9db" />
        {/* Pixel Hearth Fire + Dither Glow */}
        <rect x="63" y="58" width="16" height="19" fill="#171217" />
        <PixelDitherGlow cx={71} cy={71} radius={11} color="#ff922b" />
        <PixelStamp
          x={66}
          y={68}
          grid={FIRE_GRID}
          palette={{ K: INK, B: '#6e3d21', O: '#e8590c', Y: '#ffa94d', W: '#fff3bf' }}
        />

        {/* Champion Banner */}
        <rect x="95" y="44" width="13" height="18" fill={INK} />
        <rect x="96" y="45" width="11" height="15" fill="#a62639" />
        <rect x="99" y="48" width="5" height="5" fill={goldHi} />

        {/* Golden Trophy Display Pedestal (Right) */}
        <rect x="114" y="58" width="22" height="20" fill={INK} />
        <rect x="115" y="59" width="20" height="18" fill="#42362e" />
        <rect x="116" y="61" width="18" height="2" fill={goldDark} />
        <rect x="118" y="45" width="14" height="13" fill={INK} />
        <rect x="119" y="46" width="12" height="11" fill="#2e2d40" />
        <rect x="122" y="48" width="6" height="5" fill={gold} />
        <rect x="121" y="49" width="1" height="3" fill={goldHi} />
        <rect x="128" y="49" width="1" height="3" fill={goldHi} />
        <rect x="124" y="53" width="2" height="2" fill={goldDark} />
        <rect x="122" y="55" width="6" height="1" fill={gold} />

        <PixelStamp
          x={141}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: '#2b7a4b',
            H: '#409964',
            M: '#1f5e39',
            D: '#154227',
            B: '#ffd43b',
            S: '#4a2e16',
            P: '#a67c33',
          }}
        />

        <PixelWoodFloor
          yStart={78}
          base={isNight ? '#1f191c' : '#3d312d'}
          alt={isNight ? '#181316' : '#322824'}
          hi="#594740"
          grout="#141013"
        />
        <PixelRug
          x={32}
          y={82}
          w={96}
          h={19}
          outer="#731829"
          inner="#9c2238"
          stripe={gold}
          fringe={goldHi}
        />
      </svg>
    );
  }

  // 7. DUSK BALL ROOM (幽灵古堡阁楼)
  if (roomId === 'duskball_room') {
    const wall = isNight ? '#0e1513' : '#1b2923';
    const stripe = isNight ? '#0a100e' : '#15211c';
    const dome = '#1c5233';
    const domeDark = '#113320';
    const ember = '#e8590c';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill="#131c18" />

        {/* Dusk Ball Deep Emerald & Obsidian Dome + Orange Ring Accents */}
        <rect x="0" y="0" width="160" height="12" fill={domeDark} />
        <rect x="0" y="12" width="160" height="11" fill={dome} />
        <rect x="14" y="6" width="18" height="12" fill="#0d1210" />
        <rect x="17" y="9" width="12" height="6" fill={dome} />
        <rect x="128" y="6" width="18" height="12" fill="#0d1210" />
        <rect x="131" y="9" width="12" height="6" fill={dome} />
        <rect x="0" y="23" width="22" height="11" fill={dome} />
        <rect x="138" y="23" width="22" height="11" fill={dome} />

        <PokeballBeltAndClasp beltColor="#0b0f0d" trimColor="#c92a2a" coreColor={ember} glowColor="#ffe066" />

        {/* Gothic Pointed Arch Full-Moon Window (Left) */}
        <rect x="16" y="40" width="22" height="26" fill={INK} />
        <rect x="20" y="38" width="14" height="4" fill={INK} />
        <rect x="17" y="41" width="20" height="24" fill="#111024" />
        <rect x="21" y="39" width="12" height="3" fill="#111024" />
        {/* Stepped Pixel Full Moon */}
        <rect x="23" y="43" width="8" height="8" fill="#ffe066" />
        <rect x="24" y="42" width="6" height="10" fill="#ffe066" />
        <rect x="22" y="44" width="10" height="6" fill="#ffe066" />
        <rect x="25" y="45" width="2" height="2" fill="#fab005" />
        <rect x="26" y="41" width="2" height="24" fill={INK} />
        <rect x="17" y="53" width="20" height="2" fill={INK} />

        {/* Spooky Green-Flame Candelabra + Dither Glow */}
        <PixelDitherGlow cx={58} cy={56} radius={11} color="#69db7c" />
        <rect x="52" y="66" width="13" height="12" fill={INK} />
        <rect x="53" y="67" width="11" height="10" fill="#2b2738" />
        <PixelStamp
          x={53}
          y={56}
          grid={CANDELABRA_GRID}
          palette={{ K: INK, G: '#40c057', Y: '#d8f5a2', W: '#e9ecef', D: '#5f3dc4' }}
        />

        {/* Alchemy Potion Bookshelf (Right) */}
        <rect x="108" y="44" width="28" height="34" fill={INK} />
        <rect x="109" y="45" width="26" height="32" fill="#261f33" />
        <rect x="111" y="47" width="22" height="9" fill="#15101f" />
        <rect x="111" y="58" width="22" height="9" fill="#15101f" />
        <rect x="111" y="69" width="22" height="7" fill="#15101f" />
        {/* Glowing Potions */}
        <rect x="113" y="51" width="4" height="5" fill="#40c057" />
        <rect x="119" y="50" width="4" height="6" fill="#9775fa" />
        <rect x="126" y="51" width="4" height="5" fill="#ff6b6b" />
        <rect x="113" y="61" width="3" height="6" fill="#495057" />
        <rect x="117" y="61" width="3" height="6" fill="#7950f2" />
        <rect x="124" y="62" width="6" height="5" fill="#ffd43b" />

        {/* Glowing Shadow Plant */}
        <PixelStamp
          x={142}
          y={63}
          grid={PLANT_GRID}
          palette={{
            K: INK,
            L: '#40c057',
            H: '#b2f2bb',
            M: '#2b8a3e',
            D: '#143d22',
            B: '#9775fa',
            S: '#2b2738',
            P: '#495057',
          }}
        />

        <PixelTileFloor
          yStart={78}
          c1="#25362f"
          c2="#1a2621"
          hi="#40c057"
          grout="#0e1412"
        />
        <PixelRug
          x={40}
          y={83}
          w={80}
          h={17}
          outer="#1b4332"
          inner="#2b1e3d"
          stripe="#e8590c"
          fringe="#69db7c"
        />
      </svg>
    );
  }

  // 8. LUXURY BALL ROOM (皇冠金碧殿)
  if (roomId === 'luxuryball_room') {
    const wall = isNight ? '#210e14' : '#3d1924';
    const stripe = isNight ? '#1a0a0f' : '#33131d';
    const gold = '#fcc419';
    const goldHi = '#fff3bf';
    const red = '#c92a2a';

    return (
      <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="160" height="78" fill={wall} />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
        ))}
        <rect x="0" y="66" width="160" height="12" fill="#290f17" />

        {/* Luxury Ball Sleek Obsidian Dome with Crimson & Gold Twin Trim */}
        <rect x="0" y="0" width="160" height="24" fill="#17141c" />
        <rect x="0" y="14" width="160" height="3" fill={red} />
        <rect x="0" y="12" width="160" height="2" fill={gold} />
        <rect x="0" y="17" width="160" height="2" fill={gold} />
        <rect x="0" y="24" width="22" height="10" fill="#17141c" />
        <rect x="138" y="24" width="22" height="10" fill="#17141c" />

        <PokeballBeltAndClasp beltColor="#120f17" trimColor={gold} coreColor={red} glowColor={goldHi} />

        {/* Grand Pixel Chandelier + Dither Glow */}
        <PixelDitherGlow cx={80} cy={46} radius={13} color="#ffe066" />
        <PixelStamp
          x={71}
          y={40}
          grid={CHANDELIER_GRID}
          palette={{ K: INK, G: gold, Y: goldHi, W: '#ffffff' }}
        />

        {/* Twin Crimson Velvet Royal Drapes */}
        {[8, 128].map((dx) => (
          <g key={dx}>
            <rect x={dx} y="40" width="24" height="38" fill={INK} />
            <rect x={dx + 1} y="41" width="22" height="36" fill={red} />
            <rect x={dx + 4} y="41" width="3" height="36" fill="#e03131" />
            <rect x={dx + 14} y="41" width="3" height="36" fill="#a61e24" />
            <rect x={dx} y="40" width="24" height="3" fill={gold} />
            <rect x={dx + 1} y="62" width="22" height="2" fill={gold} />
          </g>
        ))}

        {/* Golden Framed Champion Portrait (Left & Right) */}
        <rect x="38" y="45" width="20" height="16" fill={INK} />
        <rect x="39" y="46" width="18" height="14" fill={gold} />
        <rect x="41" y="48" width="14" height="10" fill="#2b1938" />
        <rect x="45" y="50" width="6" height="5" fill={goldHi} />

        <rect x="102" y="45" width="20" height="16" fill={INK} />
        <rect x="103" y="46" width="18" height="14" fill={gold} />
        <rect x="105" y="48" width="14" height="10" fill="#2b1938" />
        <PixelStamp
          x={109}
          y={50}
          grid={POKEBALL_DOLL_GRID}
          palette={{ K: INK, R: '#e03131', H: '#ffa8a8', W: '#ffffff' }}
        />

        {/* Royal Plush Throne Lounge (Center-Back) */}
        <rect x="52" y="64" width="56" height="14" fill={INK} />
        <rect x="53" y="65" width="54" height="12" fill="#a61e24" />
        <rect x="53" y="65" width="54" height="2" fill={gold} />
        <rect x="55" y="68" width="50" height="7" fill="#c92a2a" />

        <PixelWoodFloor
          yStart={78}
          base={isNight ? '#241317' : '#4a232b'}
          alt={isNight ? '#1c0e12' : '#3d1c23'}
          hi="#783b47"
          grout="#14090c"
        />
        <PixelRug
          x={30}
          y={82}
          w={100}
          h={19}
          outer="#1c1824"
          inner="#b01e2b"
          stripe={gold}
          fringe={goldHi}
        />
      </svg>
    );
  }

  // 9. MASTER BALL ROOM (紫金星云殿)
  const wall = isNight ? '#160d29' : '#2e1a52';
  const stripe = isNight ? '#120a21' : '#261545';
  const dome = '#5822ad';
  const domeHi = '#7b3ee0';
  const orb = '#e64980';
  const orbHi = '#ffadd2';

  return (
    <svg className="pokeball-bg-svg" viewBox="0 0 160 112" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="160" height="78" fill={wall} />
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={i * 10} y="37" width="5" height="41" fill={stripe} />
      ))}
      <rect x="0" y="66" width="160" height="12" fill={isNight ? '#1b1033' : '#3a2266'} />

      {/* Master Ball Amethyst Dome + Dual Pixel Orbs + Stepped 'M' Crest */}
      <rect x="0" y="0" width="160" height="23" fill={dome} />
      <rect x="0" y="23" width="22" height="7" fill={dome} />
      <rect x="138" y="23" width="22" height="7" fill={dome} />
      <rect x="12" y="3" width="136" height="3" fill={domeHi} />

      {/* Pixel Stepped Magenta Orbs */}
      <rect x="10" y="5" width="21" height="14" fill={INK} />
      <rect x="11" y="6" width="19" height="12" fill={orb} />
      <rect x="13" y="7" width="7" height="4" fill={orbHi} />
      <rect x="129" y="5" width="21" height="14" fill={INK} />
      <rect x="130" y="6" width="19" height="12" fill={orb} />
      <rect x="132" y="7" width="7" height="4" fill={orbHi} />

      {/* Crisp Stepped Pixel 'M' Crest */}
      <rect x="72" y="6" width="3" height="14" fill="#ffffff" />
      <rect x="85" y="6" width="3" height="14" fill="#ffffff" />
      <rect x="75" y="8" width="2" height="5" fill="#ffffff" />
      <rect x="83" y="8" width="2" height="5" fill="#ffffff" />
      <rect x="77" y="11" width="6" height="4" fill="#ffffff" />

      <PokeballBeltAndClasp beltColor="#140a26" trimColor="#6741d9" coreColor={orbHi} glowColor="#ffffff" />

      {/* Twin Cosmic Nebula Observatory Windows */}
      {[24, 112].map((wx, idx) => (
        <g key={wx}>
          <rect x={wx} y="42" width="24" height="24" fill={INK} />
          <rect x={wx + 1} y="43" width="22" height="22" fill="#0d071c" />
          <rect x={wx + 3} y="48" width="12" height="5" fill="#4c1d95" />
          <rect x={wx + 8} y="54" width="12" height="5" fill="#702459" />
          <rect x={wx + 5} y="46" width="1" height="1" fill="#ffe066" />
          <rect x={wx + 17} y="48" width="1" height="1" fill="#70e4ff" />
          <rect x={wx + 9} y="59" width="1" height="1" fill="#ffffff" />
          {idx === 0 ? (
            <>
              <rect x={wx + 9} y="49" width="6" height="6" fill="#ffd43b" />
              <rect x={wx + 6} y="51" width="12" height="2" fill="#ffadd2" />
            </>
          ) : (
            <>
              <rect x={wx + 11} y="50" width="4" height="4" fill="#ff85c0" />
              <rect x={wx + 6} y="54" width="5" height="1" fill="#ffb3d9" />
            </>
          )}
        </g>
      ))}

      {/* Twin Fluted Crystal Pillars + Floating Pixel Crystals */}
      {[6, 143].map((px) => (
        <g key={px}>
          <rect x={px} y="44" width="11" height="34" fill={INK} />
          <rect x={px + 1} y="45" width="9" height="32" fill="#7950f2" />
          <rect x={px + 2} y="46" width="2" height="30" fill="#9775fa" />
          <rect x={px + 6} y="46" width="2" height="30" fill="#5f3dc4" />
          <rect x={px} y="44" width="11" height="2" fill="#ffd43b" />
          <rect x={px} y="76" width="11" height="2" fill="#ffd43b" />
          <PixelStamp
            x={px + 1}
            y={37}
            grid={CRYSTAL_GRID}
            palette={{ K: INK, H: '#fff0f6', M: '#ff85c0', P: '#faa2c1', D: '#c2255c' }}
          />
        </g>
      ))}

      {/* Central Royal Ceremonial Altar + Pixel Relic + Dither Glow */}
      <PixelDitherGlow cx={80} cy={56} radius={10} color="#70e4ff" />
      <rect x="58" y="65" width="44" height="13" fill={INK} />
      <rect x="59" y="66" width="42" height="11" fill="#4c1d95" />
      <rect x="61" y="66" width="38" height="2" fill="#ffd43b" />
      <PixelStamp
        x={76}
        y={53}
        grid={CRYSTAL_GRID}
        palette={{ K: INK, H: '#ffffff', M: '#70e4ff', P: '#a5f3fc', D: '#228be6' }}
      />

      <PixelTileFloor
        yStart={78}
        c1={isNight ? '#23133d' : '#4b2d7a'}
        c2={isNight ? '#170c29' : '#361f59'}
        hi="#9775fa"
        grout="#120921"
      />
      <PixelRug
        x={32}
        y={82}
        w={96}
        h={19}
        outer="#4f1d96"
        inner="#7928ca"
        stripe="#ffd43b"
        fringe="#ffe066"
      />
    </svg>
  );
};
