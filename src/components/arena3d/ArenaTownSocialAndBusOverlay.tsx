import React from 'react';
import { WORLD_CITIES } from '../../data/worldTour';
import { sound } from '../../utils/sound';
import { getHeldHotelKeycard, type TownInteractPoint } from '../../world3d/townTypes';
import { PixelItemImg } from '../PixelSprite';
import type { ArenaSharedCtx } from './arenaTypesAndProps';

export type PixelEmoteKind = 'heart' | 'music' | 'exclaim' | 'question' | 'sparkle' | 'happy';

export interface ActiveBusStopModalState {
  townName: string;
  busX: number;
  busZ: number;
}

export interface InteractActionItem {
  id: string;
  label: string;
  icon: string;
}

export interface NearbyActionMenuState {
  targetId: string;
  speakerName: string;
  wx: number;
  wy: number;
  wz: number;
  sx: number;
  sy: number;
  inView: boolean;
  actions: InteractActionItem[];
}

export interface LiveWorldBubble {
  id: string;
  speakerId: string;
  speakerName: string;
  emote?: PixelEmoteKind;
  wx: number;
  wy: number;
  wz: number;
  trackPos?: () => { x: number; y: number; z: number };
  pages: string[];
  pageIdx: number;
  nextAtMs: number;
  startAtMs: number;
  isPlayerDialog?: boolean;
}

export interface ProjectedBubble2D {
  id: string;
  speakerName: string;
  emote?: PixelEmoteKind;
  text: string;
  pageIdx: number;
  totalPages: number;
  sx: number;
  sy: number;
  isPlayerDialog?: boolean;
}

/**
 * Splits a long sentence into crisp bite-sized sequential pixel speech bubbles (`一个气泡接着一个气泡展示`!)
 */
export function splitSpeechIntoBubblePages(rawText: string, maxLen = 19): string[] {
  const clean = rawText.replace(/^💬\s*/, '').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const sentenceParts = clean.match(/[^！？。；…~～]+[！？。；…~～]*/g) ?? [clean];
  const pages: string[] = [];

  for (const part of sentenceParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxLen) {
      pages.push(trimmed);
      continue;
    }
    const clauses = trimmed.match(/[^，、：]+[，、：]*/g) ?? [trimmed];
    let buf = '';
    for (const cl of clauses) {
      if (!buf) {
        buf = cl;
      } else if (buf.length + cl.length <= maxLen + 2) {
        buf += cl;
      } else {
        pages.push(buf.trim());
        buf = cl;
      }
    }
    if (buf.trim()) {
      let rem = buf.trim();
      while (rem.length > maxLen + 3) {
        pages.push(rem.slice(0, maxLen));
        rem = rem.slice(maxLen);
      }
      if (rem) pages.push(rem);
    }
  }
  return pages.length > 0 ? pages : [clean];
}

export function pushWorldSpeechBubble(
  list: LiveWorldBubble[],
  opts: {
    speakerId: string;
    speakerName: string;
    text: string;
    emote?: PixelEmoteKind;
    wx: number;
    wy: number;
    wz: number;
    trackPos?: () => { x: number; y: number; z: number };
    delayMs?: number;
    isPlayerDialog?: boolean;
  },
): void {
  const nowMs = performance.now();
  const pages = splitSpeechIntoBubblePages(opts.text, 19);
  if (pages.length === 0 && !opts.emote) return;
  const finalPages = pages.length > 0 ? pages : [''];
  // Replace any existing bubble from the same speaker
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].speakerId === opts.speakerId) list.splice(i, 1);
  }
  if (list.length >= 6) {
    const dropIdx = list.findIndex((b) => !b.isPlayerDialog);
    list.splice(dropIdx >= 0 ? dropIdx : 0, 1);
  }
  const startAtMs = nowMs + (opts.delayMs ?? 0);
  const firstHold = Math.max(2050, Math.min(3400, 1150 + finalPages[0].length * 110));
  list.push({
    id: `${opts.speakerId}_${Math.floor(nowMs)}_${Math.random().toString(36).slice(2, 6)}`,
    speakerId: opts.speakerId,
    speakerName: opts.speakerName,
    emote: opts.emote,
    wx: opts.wx,
    wy: opts.wy,
    wz: opts.wz,
    trackPos: opts.trackPos,
    pages: finalPages,
    pageIdx: 0,
    startAtMs,
    nextAtMs: startAtMs + firstHold,
    isPlayerDialog: opts.isPlayerDialog,
  });
}

/**
 * Builds the ordered beside-character multi-action menu (`Tab` cycles, `E` activates!)
 */
export function buildInteractActionsForTarget(
  tp: TownInteractPoint | null,
  node: { id: string; kind: string; label: string; hp: number; maxHp: number; icon: string } | null,
): { speakerName: string; actions: InteractActionItem[] } {
  if (tp) {
    if (tp.kind === 'pokemon_center') {
      return {
        speakerName: '乔伊小姐 · 宝可梦中心',
        actions: [
          { id: 'heal', label: '全队免费治疗', icon: '/sprites/items/potion.png' },
          { id: 'chat', label: '闲聊沟通', icon: '/sprites/items/soothe-bell.png' },
          { id: 'ask', label: '询问周边情报', icon: '/sprites/items/town-map.png' },
        ],
      };
    }
    if (tp.kind === 'restaurant') {
      return {
        speakerName: '树果饭店 · 点餐台',
        actions: [
          { id: 'dine', label: '享用招牌树果拉面', icon: '/sprites/items/sitrus-berry.png' },
          { id: 'chat', label: '与店员闲聊', icon: '/sprites/items/soothe-bell.png' },
          { id: 'ask', label: '询问周边情报', icon: '/sprites/items/town-map.png' },
        ],
      };
    }
    if (tp.kind === 'poke_mart') {
      return {
        speakerName: '友好百货 · 收银员',
        actions: [
          { id: 'shop', label: '打开百货商店采购', icon: '/sprites/items/poke-ball.png' },
          { id: 'chat', label: '与店员闲聊', icon: '/sprites/items/soothe-bell.png' },
          { id: 'ask', label: '询问周边情报', icon: '/sprites/items/town-map.png' },
        ],
      };
    }
    if (tp.kind === 'hotel_desk') {
      const heldRoom = getHeldHotelKeycard(tp.hotelId);
      return {
        speakerName: '驿站酒店 · 大堂总管',
        actions: heldRoom
          ? [
              { id: 'hotel_checkin', label: `已持【${heldRoom} 房卡】· 换房`, icon: '/sprites/items/luxury-ball.png' },
              { id: 'hotel_checkout', label: '办理退房归还房卡', icon: '/sprites/items/amulet-coin.png' },
              { id: 'chat', label: '与总管闲聊', icon: '/sprites/items/soothe-bell.png' },
            ]
          : [
              { id: 'hotel_checkin', label: '办理入住领房卡 (¥60)', icon: '/sprites/items/luxury-ball.png' },
              { id: 'chat', label: '与总管闲聊', icon: '/sprites/items/soothe-bell.png' },
              { id: 'ask', label: '询问周边情报', icon: '/sprites/items/town-map.png' },
            ],
      };
    }
    if (tp.kind === 'hotel_bed' || tp.kind === 'hotel_rest') {
      return {
        speakerName: tp.label.replace(/^🛏️\s*/, ''),
        actions: [{ id: 'rest', label: '盖上被子美美睡一觉', icon: '/sprites/items/luxury-ball.png' }],
      };
    }
    if (tp.kind === 'building_door' && tp.doorRef) {
      const d = tp.doorRef;
      if (d.mode === 'hotel_keycard') {
        const heldRoom = getHeldHotelKeycard(d.hotelId);
        const toggleLabel = d.isOpen
          ? `关上 ${d.roomNumber ?? ''} 客房门`
          : heldRoom === d.roomNumber
            ? `刷【${heldRoom} 房卡】开门`
            : '尝试刷卡 / 推门';
        return {
          speakerName: d.label?.replace(/^[🔒🚪]\s*/, '') ?? '酒店客房门',
          actions: [
            { id: 'door_toggle', label: toggleLabel, icon: '/sprites/items/luxury-ball.png' },
            { id: 'door_inspect', label: '检查门牌与电子锁', icon: '/sprites/items/town-map.png' },
          ],
        };
      }
      return {
        speakerName: d.label?.replace(/^🚪\s*/, '') ?? '房门',
        actions: [
          { id: 'door_toggle', label: d.isOpen ? '随手关上门' : '手动推开门', icon: '/sprites/items/poke-ball.png' },
          { id: 'door_inspect', label: '检查门锁与标识', icon: '/sprites/items/town-map.png' },
        ],
      };
    }
    if (tp.kind === 'city_bus_stop') {
      const cleanStopTitle = tp.label.replace(/^🚏\s*|^🚌\s*/, '');
      const atHsrStop = tp.id.endsWith('_bus_hsr');
      const atHubStop = tp.id.endsWith('_bus_hub');
      const atPcStop = tp.id.endsWith('_bus_pc') || Boolean(tp.hint?.includes('宝可梦中心'));
      const quickActs: InteractActionItem[] = [];
      if (atHsrStop) {
        quickActs.push({ id: 'bus_hub', label: '乘公交回【市中心总站】', icon: '/sprites/items/town-map.png' });
      } else {
        quickActs.push({ id: 'bus_hsr', label: '乘公交去【城郊高铁站站】', icon: '/sprites/items/town-map.png' });
      }
      if (atPcStop && !atHubStop) {
        quickActs.push({ id: 'bus_hub', label: '乘公交回【市中心总站】', icon: '/sprites/items/soothe-bell.png' });
      } else if (!atPcStop) {
        quickActs.push({ id: 'bus_pc', label: '乘公交去【宝可梦中心站】', icon: '/sprites/items/potion.png' });
      }
      quickActs.push({ id: 'bus_board', label: '查看全城公交站点与邻城班次', icon: '/sprites/items/amulet-coin.png' });
      return {
        speakerName: `${tp.townName} · ${cleanStopTitle}`,
        actions: quickActs,
      };
    }
    if (tp.kind === 'transit_station') {
      return {
        speakerName: `${tp.townName} · 城郊虹桥高铁站`,
        actions: [{ id: 'hsr_map', label: '乘高铁 / 航班跨城远行', icon: '/sprites/items/town-map.png' }],
      };
    }
    if (tp.kind === 'npc_chat') {
      const prof = tp.npcProfile;
      const acts: InteractActionItem[] = [
        { id: 'chat', label: '闲聊沟通', icon: '/sprites/items/soothe-bell.png' },
        { id: 'ask', label: '询问打听指路', icon: '/sprites/items/town-map.png' },
      ];
      if (prof?.canBattle !== false) {
        acts.push({ id: 'battle', label: '发起切磋对战', icon: '/sprites/items/vs-seeker.png' });
      }
      return {
        speakerName: prof ? `${prof.name} · ${prof.role}` : tp.label.replace(/^💬\s*/, ''),
        actions: acts,
      };
    }
  }
  if (node) {
    const suffix = node.maxHp > 1 ? ` (${node.hp}/${node.maxHp})` : '';
    return {
      speakerName: node.kind === 'road_supply' ? '公路专属补给' : '野外探索交互',
      actions: [{ id: 'world_node', label: `${node.label}${suffix}`, icon: node.icon }],
    };
  }
  return { speakerName: '', actions: [] };
}

/** Crisp 9×9 GBA Pixel-Art Emote Badge rendered with crisp `<svg shapeRendering="crispEdges">` */
const PixelEmoteBadge: React.FC<{ kind: PixelEmoteKind }> = ({ kind }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        background: '#fff3bf',
        border: '2px solid #181c2b',
        marginRight: 5,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 8 8" shapeRendering="crispEdges">
        {kind === 'heart' && (
          <>
            <path d="M1 1h2v1h2V1h2v3H6v1H5v1H3V5H2V4H1z" fill="#fa5252" />
            <rect x="1" y="2" width="1" height="1" fill="#ffc9c9" />
          </>
        )}
        {kind === 'music' && (
          <>
            <path d="M3 1h4v4H6V2H4v4H2V4h1z" fill="#1c7ed6" />
            <rect x="5" y="4" width="2" height="2" fill="#1c7ed6" />
          </>
        )}
        {kind === 'exclaim' && (
          <>
            <rect x="3" y="0" width="2" height="5" fill="#e03131" />
            <rect x="3" y="6" width="2" height="2" fill="#e03131" />
          </>
        )}
        {kind === 'question' && (
          <>
            <path d="M2 1h4v3H4v1H3V3h2V2H2z" fill="#e67700" />
            <rect x="3" y="6" width="2" height="2" fill="#e67700" />
          </>
        )}
        {kind === 'sparkle' && (
          <>
            <rect x="3" y="0" width="2" height="8" fill="#f59f00" />
            <rect x="0" y="3" width="8" height="2" fill="#f59f00" />
            <rect x="3" y="3" width="2" height="2" fill="#ffffff" />
          </>
        )}
        {kind === 'happy' && (
          <>
            <rect x="1" y="2" width="2" height="1" fill="#2b8a3e" />
            <rect x="5" y="2" width="2" height="1" fill="#2b8a3e" />
            <path d="M1 5h1v1h4V5h1v2H1z" fill="#e8590c" />
          </>
        )}
      </svg>
    </span>
  );
};

function computeGreatCircleKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat * 0.5) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng * 0.5) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const ArenaTownSocialAndBusOverlay: React.FC<{ ctx: ArenaSharedCtx }> = ({ ctx }) => {
  const {
    nearbyInteract,
    interactOptionIdx,
    setInteractOptionIdx,
    executeInteractActionRef,
    projectedBubbles,
    worldBubblesRef,
    askQuickNavOpen,
    setAskQuickNavOpen,
    activeBusStopModal,
    setActiveBusStopModal,
    autoNavTargetsRef,
    startAutoNavRef,
    teleportIntraCityBusRef,
    handleFastTravelCity,
    activeWorldRun,
    liveOverlandCity,
    simRef,
    externalPaused,
    levelChoices,
    shopOpen,
    resultModal,
    nearbyKoTarget,
    hubModal,
    worldMapOpen,
    timeAlmanacOpen,
    profileOpen,
    squadEditorOpen,
    captureCutscene,
  } = ctx;

  const curSim = simRef.current;
  const px = curSim?.px ?? 0;
  const pz = curSim?.pz ?? 0;

  const menu: NearbyActionMenuState | null = nearbyInteract;
  const bubbles: ProjectedBubble2D[] = projectedBubbles ?? [];
  const showFieldUi =
    !externalPaused &&
    !levelChoices &&
    !shopOpen &&
    !resultModal &&
    !captureCutscene &&
    hubModal === 'none' &&
    !worldMapOpen &&
    !timeAlmanacOpen &&
    !profileOpen &&
    !squadEditorOpen;

  const navList: { id: string; label: string; x: number; z: number }[] = (autoNavTargetsRef?.current ?? []).filter(
    (t: { id: string }) => !t.id.includes('suite_bed') && !t.id.includes('nav_house'),
  );

  const compassDir = (tx: number, tz: number) => {
    const dx = tx - px;
    const dz = tz - pz;
    const ns = dz < -8 ? '北' : dz > 8 ? '南' : '';
    const ew = dx > 8 ? '东' : dx < -8 ? '西' : '';
    return `${ns}${ew}` || '附近';
  };

  return (
    <>
      {/* 1. LIVE 3D OVERHEAD PIXEL SPEECH & EMOTE BUBBLES (Shopkeeper Greetings, NPC-to-NPC Banter & Sequential Dialog!) */}
      {showFieldUi &&
        bubbles.map((b) => (
          <div
            key={`${b.id}_${b.pageIdx}`}
            onClick={() => {
              // Clicking a bubble skips immediately to its next sequential bubble page!
              const list: LiveWorldBubble[] = worldBubblesRef?.current ?? [];
              const target = list.find((item) => item.id === b.id);
              if (target) {
                sound.play('cursor');
                target.nextAtMs = 0;
              }
            }}
            style={{
              position: 'absolute',
              left: `${Math.max(14, Math.min(86, b.sx))}%`,
              top: `${Math.max(10, Math.min(78, b.sy))}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: b.isPlayerDialog ? 12 : 9,
              pointerEvents: b.isPlayerDialog ? 'auto' : 'none',
              cursor: b.isPlayerDialog ? 'pointer' : 'default',
              maxWidth: b.isPlayerDialog ? 278 : 228,
              minWidth: b.text ? 96 : 44,
              animation: 'survPopIn 0.16s cubic-bezier(0.2, 1.25, 0.4, 1)',
            }}
          >
            <div
              style={{
                position: 'relative',
                background: b.isPlayerDialog ? '#fffdf2' : 'rgba(255, 253, 244, 0.95)',
                color: '#181c2b',
                padding: b.text ? '8px 11px 8px' : '6px 8px',
                border: '3px solid #181c2b',
                boxShadow: '0 4px 0 #181c2b, inset 0 -3px 0 #e6dcc2',
                fontFamily: '"PingFang SC", "Microsoft YaHei", monospace',
                imageRendering: 'pixelated',
              }}
            >
              {/* Speaker Pixel Name Tag */}
              <div
                style={{
                  position: 'absolute',
                  top: -12,
                  left: 6,
                  background: b.isPlayerDialog ? '#26324d' : '#343d54',
                  color: '#ffe066',
                  border: '2px solid #181c2b',
                  padding: '0px 6px',
                  fontSize: 10,
                  fontWeight: 800,
                  lineHeight: 1.35,
                  whiteSpace: 'nowrap',
                }}
              >
                {b.speakerName}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: b.isPlayerDialog ? 12.8 : 11.8,
                  fontWeight: 700,
                  lineHeight: 1.45,
                  marginTop: 2,
                }}
              >
                {b.emote && <PixelEmoteBadge kind={b.emote} />}
                {b.text && <span style={{ wordBreak: 'break-word' }}>{b.text}</span>}
              </div>

              {b.totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 2,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#d9480f',
                  }}
                >
                  <span>
                    {b.pageIdx + 1}/{b.totalPages}
                  </span>
                  <span>{b.pageIdx + 1 < b.totalPages ? '▾' : '■'}</span>
                </div>
              )}

              {/* Stepped Pixel Speech Pointer Tail pointing down at the NPC's head! */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -10,
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '10px solid #181c2b',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -6,
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '7px solid #e6dcc2',
                }}
              />
            </div>
          </div>
        ))}

      {/* 2. BESIDE-CHARACTER MULTI-OPTION FLOATING ACTION STACK (`Tab` cycles, `E` or Click activates!) */}
      {showFieldUi && !nearbyKoTarget && menu && menu.actions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            ...(menu.inView && menu.sx > 66
              ? { right: `${Math.max(4, 100 - menu.sx + 3.8)}%` }
              : { left: menu.inView ? `${Math.max(6, Math.min(66, menu.sx + 3.8))}%` : '54%' }),
            top: menu.inView ? `${Math.max(24, Math.min(73, menu.sy))}%` : '52%',
            transform: 'translateY(-50%)',
            zIndex: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minWidth: 198,
            maxWidth: 268,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '3px 8px',
              background: 'rgba(16, 20, 32, 0.92)',
              border: '2px solid #36415e',
              color: '#a5d8ff',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {menu.speakerName}
            </span>
            {menu.actions.length > 1 && (
              <span
                style={{
                  background: '#2b3654',
                  color: '#ffe066',
                  border: '1px solid #ffe066',
                  padding: '0px 5px',
                  fontSize: 10,
                  flexShrink: 0,
                }}
              >
                TAB 切换
              </span>
            )}
          </div>

          {menu.actions.map((act, idx) => {
            const activeIdx = interactOptionIdx % menu.actions.length;
            const isSel = idx === activeIdx;
            return (
              <button
                key={act.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setInteractOptionIdx(idx);
                  executeInteractActionRef?.current?.(idx);
                }}
                onMouseEnter={() => {
                  if (interactOptionIdx !== idx) setInteractOptionIdx(idx);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: isSel ? '7px 10px' : '6px 9px',
                  background: isSel
                    ? 'linear-gradient(90deg, rgba(43, 55, 88, 0.97) 0%, rgba(28, 36, 58, 0.96) 100%)'
                    : 'rgba(18, 23, 36, 0.86)',
                  border: isSel ? '2.5px solid #ffe066' : '2px solid rgba(92, 107, 145, 0.65)',
                  boxShadow: isSel ? '0 3px 0 #141824, 0 0 12px rgba(255, 224, 102, 0.32)' : '0 2px 0 #141824',
                  color: isSel ? '#fff9db' : '#dee2e6',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12.5,
                  fontWeight: isSel ? 800 : 600,
                  transform: isSel ? 'translateX(3px)' : 'none',
                  transition: 'transform 0.08s ease, border-color 0.08s ease',
                }}
              >
                <span style={{ color: '#ffe066', fontSize: 11, width: 10 }}>{isSel ? '▶' : ''}</span>
                <PixelItemImg src={act.icon} size={18} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {act.label}
                </span>
                {isSel && (
                  <span
                    style={{
                      background: '#ffe066',
                      color: '#141824',
                      padding: '1px 6px',
                      fontSize: 11,
                      fontWeight: 900,
                      border: '1.5px solid #141824',
                      flexShrink: 0,
                    }}
                  >
                    E
                  </span>
                )}
              </button>
            );
          })}

          {askQuickNavOpen && navList.length > 0 && (
            <div
              style={{
                marginTop: 3,
                padding: '6px 7px',
                background: 'rgba(15, 22, 38, 0.95)',
                border: '2px solid #4dabf7',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#74c0fc' }}>
                <span>🧭 点击地点自动带路前往：</span>
                <span style={{ cursor: 'pointer', color: '#adb5bd' }} onClick={() => setAskQuickNavOpen(false)}>
                  ✕
                </span>
              </div>
              {navList.slice(0, 5).map((item) => {
                const distM = Math.max(1, Math.round(Math.hypot(item.x - px, item.z - pz)));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAskQuickNavOpen(false);
                      startAutoNavRef?.current?.({ label: item.label, x: item.x, z: item.z });
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 6,
                      padding: '4px 7px',
                      background: '#1e2c4a',
                      border: '1px solid #3b5bdb',
                      color: '#fff',
                      fontSize: 11.5,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    <em style={{ fontStyle: 'normal', color: '#ffd43b', flexShrink: 0 }}>
                      {compassDir(item.x, item.z)} {distM}m
                    </em>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. FULL BUS LINE BOARD MODAL */}
      {activeBusStopModal && (
        <div
          className="surv-modal-backdrop"
          style={{ zIndex: 92, background: 'rgba(10, 14, 24, 0.62)' }}
          onClick={() => {
            sound.play('cancel');
            setActiveBusStopModal(null);
          }}
        >
          <div
            className="surv-modal-card"
            style={{
              maxWidth: 540,
              width: '94vw',
              padding: '18px 20px',
              border: '3px solid #ffd43b',
              background: 'linear-gradient(180deg, #192338 0%, #101624 100%)',
              color: '#f8f9fa',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const { townName, busX, busZ } = activeBusStopModal;
              const intraStops: {
                id: string;
                label: string;
                subLabel?: string;
                icon: string;
                x: number;
                z: number;
              }[] = (autoNavTargetsRef?.current ?? []).filter(
                (t: { id: string; x: number; z: number }) =>
                  t.id.includes('_bus_') && Math.hypot(t.x - busX, t.z - busZ) < 3400,
              );
              const curStopItem = intraStops.find((s) => Math.hypot(s.x - px, s.z - pz) < 14);

              const curCityId = liveOverlandCity?.id ?? activeWorldRun?.cityId ?? 'shanghai';
              const curCityObj = WORLD_CITIES.find((c) => c.id === curCityId);
              const overlandCoachCities = curCityObj
                ? WORLD_CITIES.filter((c) => {
                    if (c.id === curCityObj.id) return false;
                    if (c.id === 'okinawa' || curCityObj.id === 'okinawa') return false;
                    if (c.country !== curCityObj.country) return false;
                    const distKm = computeGreatCircleKm(curCityObj.lat, curCityObj.lng, c.lat, c.lng);
                    return distKm <= 380;
                  }).map((c) => ({
                    city: c,
                    distKm: Math.round(computeGreatCircleKm(curCityObj.lat, curCityObj.lng, c.lat, c.lng)),
                  }))
                : [];

              const closeBus = () => {
                sound.play('cancel');
                setActiveBusStopModal(null);
              };

              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PixelItemImg src="/sprites/items/town-map.png" size={24} />
                      <div>
                        <strong style={{ fontSize: 16, color: '#ffd43b' }}>
                          🚏 {townName} · {curStopItem ? curStopItem.label.replace(/^🚏\s*/, '') : '市内公交与陆路客运站'}
                        </strong>
                        <div style={{ fontSize: 11.5, color: '#adb5bd' }}>
                          站站均设实体候车亭，下车后可随时返程或换乘 · 跨省高铁与航班请乘至「高铁站公交站」换乘
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeBus}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #495057',
                        background: '#212529',
                        color: '#dee2e6',
                        cursor: 'pointer',
                      }}
                    >
                      关闭
                    </button>
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#74c0fc', margin: '8px 0 6px' }}>
                    🚏 市内双向环线公交站（仅停靠设站候车亭 · 免费双向往返）
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))',
                      gap: 8,
                      maxHeight: 230,
                      overflowY: 'auto',
                      marginBottom: 12,
                    }}
                  >
                    {intraStops.map((st) => {
                      const isHsrStop = st.id.endsWith('_bus_hsr');
                      const rawUnits = Math.hypot(st.x - px, st.z - pz);
                      const isHere = rawUnits < 14;
                      const distMeters = Math.max(1, Math.round(rawUnits * 10));
                      const distLabel =
                        distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)}km` : `${distMeters}m`;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          disabled={isHere}
                          onClick={() => {
                            if (isHere) return;
                            closeBus();
                            teleportIntraCityBusRef?.current?.(st.x, st.z, st.label);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            padding: '9px 11px',
                            borderRadius: 8,
                            border: isHere
                              ? '2px solid #51cf66'
                              : isHsrStop
                                ? '2px solid #fcc419'
                                : '1.5px solid #3b5bdb',
                            background: isHere ? '#1b3626' : isHsrStop ? '#2e2918' : '#1b2640',
                            color: '#fff',
                            cursor: isHere ? 'default' : 'pointer',
                            fontSize: 12.5,
                            textAlign: 'left',
                            opacity: isHere ? 0.96 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                            <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {st.label}
                            </span>
                            <span
                              style={{
                                color: isHere ? '#69db7c' : isHsrStop ? '#ffe066' : '#a5d8ff',
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {isHere ? '📍 本站' : `${distLabel} · 乘车`}
                            </span>
                          </div>
                          {st.subLabel && (
                            <div style={{ fontSize: 10.5, color: '#adb5bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {st.subLabel}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#69db7c', margin: '6px 0 6px' }}>
                    🛣️ 陆路城际长途巴士（仅限周边公路邻城 · 不可跨海飞行）
                  </div>
                  {overlandCoachCities.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                      {overlandCoachCities.map(({ city, distKm }) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => {
                            closeBus();
                            handleFastTravelCity?.(city.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 11px',
                            borderRadius: 8,
                            border: '1.5px solid #40c057',
                            background: '#193326',
                            color: '#ebfbee',
                            cursor: 'pointer',
                            fontSize: 12.5,
                          }}
                        >
                          <span>🚌 前往 {city.name}</span>
                          <em style={{ fontStyle: 'normal', color: '#b2f2bb', fontSize: 11.5 }}>公路 {distKm}km</em>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: '#1a2030',
                        color: '#adb5bd',
                        fontSize: 12,
                      }}
                    >
                      当前城市周边 380km 内暂无直达公路大巴班次，请乘上方市内公交前往「🚄 城郊高铁站」换乘！
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
};
