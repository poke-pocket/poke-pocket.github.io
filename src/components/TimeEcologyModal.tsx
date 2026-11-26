import React, { useState } from 'react';
import { SPECIES_CATALOG } from '../data/catalog';
import type { SpeciesId } from '../types/pet';
import type { DayNightPhase, SolarDayNightState, WorldTimeOverride } from '../utils/solarDayNight3D';
import { PixelIcon, PixelItemImg } from './PixelSprite';

export interface TimeEcologyEntry {
  species: SpeciesId;
  rateLabel: string;
  rateColor: string;
  habitatNote: string;
}

export interface SolarPhaseEcologyMeta {
  phase: DayNightPhase;
  tabLabel: string;
  emoji: string;
  timeWindowHint: string;
  themeColor: string;
  buffTitle: string;
  buffDesc: string;
  spawns: TimeEcologyEntry[];
}

export const SOLAR_PHASE_ECOLOGY: Record<DayNightPhase, SolarPhaseEcologyMeta> = {
  dawn: {
    phase: 'dawn',
    tabLabel: '清晨日出',
    emoji: '🌅',
    timeWindowHint: '日出前后 · 朝露初醒',
    themeColor: '#ff922b',
    buffTitle: '朝露苏醒生态',
    buffDesc: '草系、飞行系与虫系宝可梦在晨雾与公园林间格外活跃，稀有治愈系偶有现身。',
    spawns: [
      { species: 'pidgey', rateLabel: '高频出没', rateColor: '#51cf66', habitatNote: '街道行道树与屋檐' },
      { species: 'caterpie', rateLabel: '高频出没', rateColor: '#51cf66', habitatNote: '城市公园灌木丛' },
      { species: 'bulbasaur', rateLabel: '清晨活跃', rateColor: '#38d9a9', habitatNote: '晨光草坪与河畔' },
      { species: 'weedle', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '林荫步道花坛' },
      { species: 'bellsprout', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '湿润绿地周边' },
      { species: 'farfetchd', rateLabel: '清晨限定', rateColor: '#ffd43b', habitatNote: '河岸浅滩晨练' },
      { species: 'poliwag', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '滨江步道水岸' },
      { species: 'chansey', rateLabel: '稀有奇遇', rateColor: '#f783ac', habitatNote: '宝可梦中心附近广场' },
    ],
  },
  day: {
    phase: 'day',
    tabLabel: '正午白昼',
    emoji: '☀️',
    timeWindowHint: '日出后至午后 · 晴空万里',
    themeColor: '#fcc419',
    buffTitle: '晴空日照生态',
    buffDesc: '电系、火系与一般系宝可梦全城活跃，商业街区与公园广场充满生机。',
    spawns: [
      { species: 'pikachu', rateLabel: '白昼活跃', rateColor: '#ffd43b', habitatNote: '繁华商业街与广场' },
      { species: 'charmander', rateLabel: '白昼活跃', rateColor: '#ff922b', habitatNote: '阳光充足的街角' },
      { species: 'squirtle', rateLabel: '白昼活跃', rateColor: '#4dabf7', habitatNote: '喷泉公园与桥梁畔' },
      { species: 'eevee', rateLabel: '高频出没', rateColor: '#51cf66', habitatNote: '复式公寓与咖啡馆旁' },
      { species: 'growlithe', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '十字路口巡逻岗' },
      { species: 'machop', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '高架桥与车站周边' },
      { species: 'munchlax', rateLabel: '午间贪吃', rateColor: '#ffd43b', habitatNote: '树果餐厅与超市门前' },
      { species: 'scyther', rateLabel: '稀有奇遇', rateColor: '#ae3ec9', habitatNote: '世纪公园密林深处' },
    ],
  },
  dusk: {
    phase: 'dusk',
    tabLabel: '落日黄昏',
    emoji: '🌇',
    timeWindowHint: '日落前后 · 逢魔暮光',
    themeColor: '#f76707',
    buffTitle: '逢魔暮光生态',
    buffDesc: '夕阳余晖下火系、超能系与水岸龙系宝可梦出没率显著提升，江面波光粼粼。',
    spawns: [
      { species: 'vulpix', rateLabel: '暮光活跃', rateColor: '#ff922b', habitatNote: '夕阳林荫大道' },
      { species: 'ponyta', rateLabel: '暮光活跃', rateColor: '#ff922b', habitatNote: '滨江大道开阔街区' },
      { species: 'psyduck', rateLabel: '高频出没', rateColor: '#51cf66', habitatNote: '黄昏河岸与桥头' },
      { species: 'abra', rateLabel: '黄昏闪现', rateColor: '#ffd43b', habitatNote: '摩天大楼天台与街角' },
      { species: 'slowpoke', rateLabel: '时段常见', rateColor: '#74c0fc', habitatNote: '滨水公园长椅旁' },
      { species: 'staryu', rateLabel: '暮色初现', rateColor: '#74c0fc', habitatNote: '海湾与江岸码头' },
      { species: 'dratini', rateLabel: '黄昏稀有', rateColor: '#da77f2', habitatNote: '跨江大桥深水航道' },
      { species: 'aerodactyl', rateLabel: '稀有奇遇', rateColor: '#ff6b6b', habitatNote: '远郊山脊与高空掠影' },
    ],
  },
  night: {
    phase: 'night',
    tabLabel: '星夜降临',
    emoji: '🌙',
    timeWindowHint: '日落后至破晓前 · 万家灯火',
    themeColor: '#748ffc',
    buffTitle: '夜行暗影与月华生态',
    buffDesc: '城市路灯与橱窗亮起后，幽灵系、夜行系与月光妖精系宝可梦大量现身街头！',
    spawns: [
      { species: 'gastly', rateLabel: '夜间高频', rateColor: '#9775fa', habitatNote: '夜色街巷与高架桥下' },
      { species: 'zubat', rateLabel: '夜间高频', rateColor: '#51cf66', habitatNote: '霓虹路灯与隧道口' },
      { species: 'meowth', rateLabel: '夜巡活跃', rateColor: '#ffd43b', habitatNote: '亮灯百货超市与酒店门前' },
      { species: 'clefairy', rateLabel: '月夜限定', rateColor: '#f783ac', habitatNote: '月光公园喷泉广场' },
      { species: 'jigglypuff', rateLabel: '夜间常见', rateColor: '#74c0fc', habitatNote: '灯火通明的餐厅街角' },
      { species: 'oddish', rateLabel: '夜行苏醒', rateColor: '#51cf66', habitatNote: '夜间草坪与花圃' },
      { species: 'drowzee', rateLabel: '夜间常见', rateColor: '#74c0fc', habitatNote: '静谧公寓街区' },
      { species: 'mew', rateLabel: '星夜幻之', rateColor: '#ffa8a8', habitatNote: '午夜地标塔尖奇遇' },
    ],
  },
};

export function getSolarEcologicalSpeciesPool(phase: DayNightPhase): SpeciesId[] {
  return SOLAR_PHASE_ECOLOGY[phase].spawns.map((s) => s.species);
}

interface TimeEcologyModalProps {
  solar: SolarDayNightState;
  locationName: string;
  timeOverride: WorldTimeOverride;
  onChangeTimeOverride: (mode: WorldTimeOverride) => void;
  onClose: () => void;
}

export const TimeEcologyModal: React.FC<TimeEcologyModalProps> = ({
  solar,
  locationName,
  timeOverride,
  onChangeTimeOverride,
  onClose,
}) => {
  const [selectedTab, setSelectedTab] = useState<DayNightPhase>(solar.phase);
  const activeMeta = SOLAR_PHASE_ECOLOGY[selectedTab];

  // Parse HH:MM to percentage along 24h bar
  const parsePct = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((n) => Number(n) || 0);
    return Math.max(2, Math.min(98, ((h * 60 + m) / 1440) * 100));
  };
  const nowPct = parsePct(solar.localTimeStr);
  const risePct = parsePct(solar.sunriseStr);
  const setPct = parsePct(solar.sunsetStr);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250,
        background: 'rgba(10, 14, 26, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(760px, 96vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#161b2e',
          border: '3px solid #3b4262',
          boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          borderRadius: '12px',
          color: '#f1f5f9',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{solar.phaseEmoji}</span>
            <div>
              <strong style={{ fontSize: '16px', letterSpacing: '0.5px', display: 'block' }}>
                昼夜星象与时段精灵生态
              </strong>
              <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                📍 {locationName} · 根据真实经纬度实时解算日出日落与野生宝可梦作息
              </small>
            </div>
          </div>
          <button
            type="button"
            className="pkb-esc-btn"
            onClick={onClose}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            <PixelIcon name="arrow_left" size={12} />
            <span>返回</span>
          </button>
        </div>

        {/* Live Astronomical Sun/Moon Status & 24h Timeline */}
        <div
          style={{
            background: '#1e253d',
            border: '2px solid #2e3859',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#ffe066', fontFamily: 'monospace' }}>
                {solar.localTimeStr}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(255, 224, 102, 0.14)',
                  border: '1px solid #ffe066',
                  color: '#ffe066',
                }}
              >
                当前：{solar.phaseEmoji} {solar.phaseLabel}（太阳高度角 {solar.solarElevationDeg}°）
              </span>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#e2e8f0' }}>
              <span>🌅 今日日出 <strong>{solar.sunriseStr}</strong></span>
              <span>🌇 今日日落 <strong>{solar.sunsetStr}</strong></span>
            </div>
          </div>

          {/* 24-Hour Day/Night Visual Bar */}
          <div style={{ position: 'relative', height: '18px', borderRadius: '9px', overflow: 'hidden', background: '#0f172a', border: '1px solid #334155' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${risePct}%`,
                width: `${Math.max(4, setPct - risePct)}%`,
                background: 'linear-gradient(90deg, #ff922b 0%, #ffd43b 25%, #74c0fc 50%, #ffd43b 78%, #f76707 100%)',
                opacity: 0.85,
              }}
            />
            <div
              title={`当前当地时间 ${solar.localTimeStr}`}
              style={{
                position: 'absolute',
                top: '1px',
                bottom: '1px',
                left: `calc(${nowPct}% - 7px)`,
                width: '14px',
                borderRadius: '999px',
                background: '#ffffff',
                border: '2px solid #1e293b',
                boxShadow: '0 0 8px #ffe066',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
            <span>00:00 子夜</span>
            <span>🌅 {solar.sunriseStr} 日出</span>
            <span>12:00 正午</span>
            <span>🌇 {solar.sunsetStr} 日落</span>
            <span>24:00 深夜</span>
          </div>
        </div>

        {/* 4 Time-of-Day Ecological Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {(['dawn', 'day', 'dusk', 'night'] as DayNightPhase[]).map((ph) => {
            const meta = SOLAR_PHASE_ECOLOGY[ph];
            const isSel = selectedTab === ph;
            const isCurrent = solar.phase === ph;
            return (
              <button
                key={ph}
                type="button"
                onClick={() => setSelectedTab(ph)}
                style={{
                  padding: '8px 6px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isSel ? `2px solid ${meta.themeColor}` : '2px solid #2b3452',
                  background: isSel ? 'rgba(59, 66, 98, 0.72)' : '#1a2036',
                  color: isSel ? '#ffffff' : '#cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '16px' }}>{meta.emoji}</span>
                <strong style={{ fontSize: '12px' }}>{meta.tabLabel}</strong>
                {isCurrent && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: meta.themeColor,
                      color: '#111827',
                      fontWeight: 700,
                    }}
                  >
                    当前时段
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Period Ecological Details & Active Pokémon Grid */}
        <div
          style={{
            background: '#1b2238',
            border: `2px solid ${activeMeta.themeColor}66`,
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <strong style={{ color: activeMeta.themeColor, fontSize: '14px' }}>
                {activeMeta.emoji} {activeMeta.buffTitle}
              </strong>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#94a3b8' }}>
                ({activeMeta.timeWindowHint})
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
            {activeMeta.buffDesc}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(162px, 1fr))',
              gap: '8px',
            }}
          >
            {activeMeta.spawns.map((entry) => {
              const cat = SPECIES_CATALOG[entry.species];
              if (!cat) return null;
              return (
                <div
                  key={entry.species}
                  style={{
                    background: '#131829',
                    border: '1.5px solid #2b3554',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                  }}
                >
                  <img
                    src={cat.stageSprites.baby.static}
                    alt={cat.defaultName}
                    style={{ width: 38, height: 38, imageRendering: 'pixelated', objectFit: 'contain' }}
                    draggable={false}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{cat.defaultName}</strong>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: `1px solid ${entry.rateColor}`,
                          color: entry.rateColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.rateLabel}
                      </span>
                    </div>
                    <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                      {entry.habitatNote}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Time Environment Mode Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '4px',
            borderTop: '1px solid #2b3452',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
            <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
            <span>场景光影与昼夜时间：</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(
              [
                ['auto', '🌍 经纬度实时'],
                ['day', '☀️ 白昼体验'],
                ['dusk', '🌇 黄昏体验'],
                ['night', '🌙 夜景体验'],
              ] as [WorldTimeOverride, string][]
            ).map(([mode, label]) => {
              const active = timeOverride === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeTimeOverride(mode)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: active ? '2px solid #ffe066' : '1.5px solid #334155',
                    background: active ? '#2b3454' : '#111827',
                    color: active ? '#ffe066' : '#cbd5e1',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
