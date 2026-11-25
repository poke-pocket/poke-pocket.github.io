import React from 'react';
import type { PokemonElement } from '../types/pet';

export interface ActiveSkillVfx {
  seq: number;
  element: PokemonElement;
  kind: 'damage' | 'buff_atk' | 'buff_def' | 'heal';
  target: 'enemy' | 'player';
  bonusCoins?: boolean;
}

/**
 * Rich pure-pixel-art Elemental Skill VFX overlay rendered inside BattleArena.
 * Every element & move category renders crisp stepped pixel animations (ZERO smooth blur/circles!).
 */
export const BattleSkillVfx: React.FC<{ vfx: ActiveSkillVfx }> = ({ vfx }) => {
  const { element, kind, target, bonusCoins } = vfx;
  const sideClass = target === 'enemy' ? 'on-enemy' : 'on-player';

  // Buff / Heal self-aura animations
  if (kind === 'heal') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-heal`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Rising pixel crosses & emerald sparkles */}
          <g className="vfx-rise-1">
            <rect x="8" y="28" width="6" height="2" fill="#40c057" />
            <rect x="10" y="26" width="2" height="6" fill="#40c057" />
            <rect x="10" y="28" width="2" height="2" fill="#d8f5a2" />
          </g>
          <g className="vfx-rise-2">
            <rect x="30" y="24" width="6" height="2" fill="#51cf66" />
            <rect x="32" y="22" width="2" height="6" fill="#51cf66" />
            <rect x="32" y="24" width="2" height="2" fill="#ffffff" />
          </g>
          <g className="vfx-rise-3">
            <rect x="19" y="18" width="8" height="2" fill="#ff85c0" />
            <rect x="22" y="15" width="2" height="8" fill="#ff85c0" />
            <rect x="22" y="18" width="2" height="2" fill="#fff0f6" />
          </g>
          <rect x="14" y="34" width="2" height="2" fill="#b2f2bb" className="vfx-blink" />
          <rect x="28" y="32" width="2" height="2" fill="#ffe066" className="vfx-blink" />
          <rect x="22" y="36" width="3" height="3" fill="#ffffff" className="vfx-blink" />
        </svg>
      </div>
    );
  }

  if (kind === 'buff_atk' || kind === 'buff_def') {
    const main = kind === 'buff_atk' ? '#ff5924' : '#339af0';
    const hi = kind === 'buff_atk' ? '#ffe066' : '#a5d8ff';
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-buff`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Rising pixel chevrons */}
          {[8, 20, 32].map((x, i) => (
            <g key={x} className={`vfx-rise-${i + 1}`}>
              <rect x={x + 2} y="24" width="2" height="2" fill={hi} />
              <rect x={x} y="26" width="6" height="2" fill={main} />
              <rect x={x + 2} y="28" width="2" height="6" fill={main} />
              <rect x={x + 2} y="26" width="2" height="2" fill="#ffffff" />
            </g>
          ))}
          <rect x="6" y="36" width="36" height="2" fill={main} opacity={0.7} />
          <rect x="10" y="34" width="28" height="2" fill={hi} opacity={0.8} />
        </svg>
      </div>
    );
  }

  // Element-specific offensive pixel VFX
  if (element === 'electric') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-strike`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Jagged vertical pixel lightning bolt */}
          <rect x="22" y="0" width="6" height="8" fill="#1c1926" />
          <rect x="23" y="0" width="4" height="8" fill="#ffd43b" />
          <rect x="17" y="8" width="9" height="8" fill="#1c1926" />
          <rect x="18" y="8" width="7" height="8" fill="#ffe066" />
          <rect x="20" y="10" width="3" height="6" fill="#ffffff" />
          <rect x="21" y="16" width="10" height="8" fill="#1c1926" />
          <rect x="22" y="16" width="8" height="8" fill="#ffd43b" />
          <rect x="24" y="18" width="3" height="6" fill="#ffffff" />
          <rect x="16" y="24" width="10" height="10" fill="#1c1926" />
          <rect x="17" y="24" width="8" height="10" fill="#ffe066" />
          <rect x="19" y="26" width="3" height="6" fill="#ffffff" />
          <rect x="20" y="34" width="6" height="8" fill="#ffd43b" />
          {/* Crackling side sparks */}
          <rect x="6" y="20" width="4" height="2" fill="#ffe066" className="vfx-blink" />
          <rect x="8" y="18" width="2" height="6" fill="#ffffff" className="vfx-blink" />
          <rect x="36" y="26" width="4" height="2" fill="#ffd43b" className="vfx-blink" />
          <rect x="38" y="24" width="2" height="6" fill="#ffffff" className="vfx-blink" />
          <rect x="10" y="36" width="3" height="3" fill="#ffe066" />
          <rect x="34" y="12" width="3" height="3" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  if (element === 'fire') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-burst`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Blazing pixel fireball cluster */}
          <rect x="12" y="14" width="24" height="22" fill="#d9480f" />
          <rect x="16" y="10" width="16" height="28" fill="#ff5924" />
          <rect x="10" y="18" width="28" height="14" fill="#ff5924" />
          <rect x="16" y="16" width="16" height="16" fill="#ffa94d" />
          <rect x="19" y="12" width="10" height="22" fill="#ffd43b" />
          <rect x="20" y="19" width="8" height="10" fill="#fff9db" />
          <rect x="22" y="21" width="4" height="6" fill="#ffffff" />
          {/* Flying pixel embers */}
          <rect x="6" y="12" width="3" height="3" fill="#ff6b6b" className="vfx-rise-1" />
          <rect x="38" y="10" width="3" height="3" fill="#ffd43b" className="vfx-rise-2" />
          <rect x="8" y="34" width="3" height="3" fill="#ffa94d" className="vfx-rise-3" />
          <rect x="36" y="32" width="3" height="3" fill="#ff5924" className="vfx-rise-1" />
        </svg>
      </div>
    );
  }

  if (element === 'water') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-burst`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Concentric stepped pixel hydro rings + splash droplets */}
          <rect x="12" y="12" width="24" height="2" fill="#1c7ed6" />
          <rect x="12" y="34" width="24" height="2" fill="#1c7ed6" />
          <rect x="10" y="14" width="2" height="20" fill="#1c7ed6" />
          <rect x="36" y="14" width="2" height="20" fill="#1c7ed6" />
          <rect x="15" y="15" width="18" height="18" fill="#339af0" />
          <rect x="18" y="18" width="12" height="12" fill="#74c0fc" />
          <rect x="21" y="21" width="6" height="6" fill="#e7f5ff" />
          {/* Droplet splashes */}
          <rect x="6" y="10" width="3" height="4" fill="#74c0fc" className="vfx-rise-1" />
          <rect x="39" y="12" width="3" height="4" fill="#339af0" className="vfx-rise-2" />
          <rect x="7" y="34" width="4" height="3" fill="#a5d8ff" className="vfx-rise-3" />
          <rect x="37" y="33" width="4" height="3" fill="#e7f5ff" className="vfx-rise-1" />
        </svg>
      </div>
    );
  }

  if (element === 'grass') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-slash`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Diagonal spinning razor pixel leaves */}
          {[
            [6, 12],
            [20, 18],
            [32, 26],
            [14, 30],
            [28, 8],
          ].map(([lx, ly], idx) => (
            <g key={idx}>
              <rect x={lx + 2} y={ly} width="6" height="2" fill="#2b8a3e" />
              <rect x={lx} y={ly + 2} width="8" height="3" fill="#40c057" />
              <rect x={lx + 2} y={ly + 2} width="4" height="1" fill="#b2f2bb" />
              <rect x={lx + 1} y={ly + 5} width="5" height="2" fill="#2b8a3e" />
            </g>
          ))}
          {/* Diagonal slash highlight */}
          <rect x="8" y="34" width="6" height="4" fill="#d8f5a2" />
          <rect x="14" y="28" width="6" height="4" fill="#ffffff" />
          <rect x="20" y="22" width="8" height="4" fill="#ffffff" />
          <rect x="28" y="16" width="6" height="4" fill="#d8f5a2" />
        </svg>
      </div>
    );
  }

  if (element === 'ghost' || element === 'psychic' || element === 'dragon') {
    const outer =
      element === 'ghost' ? '#4c1d95' : element === 'psychic' ? '#c2255c' : '#364fc7';
    const mid =
      element === 'ghost' ? '#7950f2' : element === 'psychic' ? '#f06595' : '#5c7cfa';
    const core =
      element === 'ghost' ? '#d0bfff' : element === 'psychic' ? '#ffdeeb' : '#ffd43b';
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-burst`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Stepped pixel energy orb + concentric arcane waves */}
          <rect x="10" y="16" width="28" height="16" fill={outer} />
          <rect x="16" y="10" width="16" height="28" fill={outer} />
          <rect x="14" y="14" width="20" height="20" fill={mid} />
          <rect x="18" y="18" width="12" height="12" fill={core} />
          <rect x="21" y="21" width="6" height="6" fill="#ffffff" />
          <rect x="6" y="8" width="4" height="4" fill={mid} className="vfx-blink" />
          <rect x="38" y="36" width="4" height="4" fill={core} className="vfx-blink" />
          <rect x="36" y="10" width="3" height="3" fill="#ffffff" className="vfx-blink" />
          <rect x="8" y="35" width="3" height="3" fill={mid} className="vfx-blink" />
        </svg>
      </div>
    );
  }

  if (element === 'fairy') {
    return (
      <div className={`skill-vfx-layer ${sideClass} vfx-burst`} aria-hidden="true">
        <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
          {/* Starlight & pink pixel sparkles */}
          {[
            [12, 12, '#ff85c0'],
            [28, 10, '#ffe066'],
            [20, 22, '#ffffff'],
            [10, 28, '#fcc2d7'],
            [32, 26, '#ff85c0'],
          ].map(([sx, sy, col], i) => (
            <g key={i} className="vfx-blink">
              <rect x={(sx as number) + 3} y={sy as number} width="2" height="8" fill={col as string} />
              <rect x={sx as number} y={(sy as number) + 3} width="8" height="2" fill={col as string} />
              <rect x={(sx as number) + 3} y={(sy as number) + 3} width="2" height="2" fill="#ffffff" />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // Normal / Physical impact slash (+ spinning pixel coins for Pay Day!)
  return (
    <div className={`skill-vfx-layer ${sideClass} vfx-slash`} aria-hidden="true">
      <svg viewBox="0 0 48 48" shapeRendering="crispEdges" className="skill-vfx-svg">
        {/* Crisp anime pixel cross-slash */}
        <rect x="8" y="10" width="6" height="4" fill="#1c1926" />
        <rect x="10" y="12" width="6" height="4" fill="#ffffff" />
        <rect x="16" y="18" width="8" height="4" fill="#ffffff" />
        <rect x="24" y="24" width="8" height="4" fill="#ffe066" />
        <rect x="32" y="30" width="6" height="4" fill="#ffffff" />
        <rect x="32" y="12" width="6" height="4" fill="#ffffff" />
        <rect x="24" y="18" width="8" height="4" fill="#ffe066" />
        <rect x="16" y="24" width="8" height="4" fill="#ffffff" />
        <rect x="10" y="30" width="6" height="4" fill="#ffffff" />
        {bonusCoins && (
          <>
            <rect x="12" y="6" width="6" height="6" fill="#fab005" className="vfx-rise-1" />
            <rect x="14" y="8" width="2" height="2" fill="#fff9db" className="vfx-rise-1" />
            <rect x="32" y="8" width="6" height="6" fill="#ffd43b" className="vfx-rise-2" />
            <rect x="34" y="10" width="2" height="2" fill="#ffffff" className="vfx-rise-2" />
          </>
        )}
      </svg>
    </div>
  );
};
