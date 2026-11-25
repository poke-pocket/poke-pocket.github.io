import React, { useState } from 'react';
import {
  FOOD_CATALOG,
  SPECIES_CATALOG,
  getPokemonCryId,
  pickRandomPetName,
} from '../data/catalog';
import type { SpeciesId } from '../types/pet';
import { sound } from '../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetSprite } from './PixelSprite';

const STARTER_LIST: SpeciesId[] = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];

interface AdoptionModalProps {
  isFirstPet: boolean;
  onClose?: () => void;
  onAdopt: (species: SpeciesId, name: string) => void;
}

export const AdoptionModal: React.FC<AdoptionModalProps> = ({
  isFirstPet,
  onClose,
  onAdopt,
}) => {
  const [species, setSpecies] = useState<SpeciesId>('pikachu');
  const [name, setName] = useState(SPECIES_CATALOG.pikachu.defaultName);
  const [step, setStep] = useState<'pick' | 'hatch'>('pick');
  const [taps, setTaps] = useState(0);
  const [shaking, setShaking] = useState(false);

  const selectedMeta = SPECIES_CATALOG[species];
  const favFood = FOOD_CATALOG.find((f) => f.id === selectedMeta.favoriteFood);

  const handleSelectSpecies = (id: SpeciesId) => {
    sound.play('cursor');
    sound.playCry(getPokemonCryId(id, 5));
    setSpecies(id);
    setName(SPECIES_CATALOG[id].defaultName);
  };

  const handleRandomName = () => {
    sound.play('cursor');
    setName(pickRandomPetName(species, [name]));
  };

  const handlePokeballTap = () => {
    const next = taps + 1;
    setShaking(true);
    window.setTimeout(() => setShaking(false), 260);
    if (next < 3) {
      sound.play('confirm');
      setTaps(next);
    } else {
      sound.play('hatch');
      window.setTimeout(() => sound.playCry(getPokemonCryId(species, 5)), 320);
      setTaps(3);
      window.setTimeout(() => {
        onAdopt(species, name.trim() || selectedMeta.defaultName);
      }, 650);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="pixel-modal">
        <div className="modal-header">
          <h2 className="inline-icon-row">
            <PixelItemImg src="/sprites/items/poke-ball.png" size={24} />
            <span>
              {isFirstPet ? '大木研究所 · 选择初始搭档宝可梦' : '收服新的同行宝可梦'}
            </span>
          </h2>
          {!isFirstPet && onClose && (
            <button type="button" className="modal-close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {step === 'pick' ? (
          <>
            <p className="modal-subtitle">
              挑选你的初始搭档宝可梦！后续还能去「宝可梦市场」买盲盒抽卡收集全图鉴（共 12 系）！
            </p>

            <div className="species-grid">
              {STARTER_LIST.map((id) => {
                const meta = SPECIES_CATALOG[id];
                const active = species === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`species-card ${active ? 'is-active' : ''}`}
                    onClick={() => handleSelectSpecies(id)}
                  >
                    <span className="dex-mini">{meta.dexNo}</span>
                    <PixelPetSprite species={id} stage="baby" size={74} />
                    <strong>{meta.title}</strong>
                    <span
                      className="poke-type-pill"
                      style={{ backgroundColor: meta.typeColor }}
                    >
                      <PixelIcon name={meta.typeIcon} size={10} />
                      <span>{meta.typeLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="selected-species-box">
              <div className="selected-preview">
                <PixelPetSprite species={species} stage="baby" size={88} />
              </div>
              <div className="selected-info">
                <div className="info-title">
                  <strong>{selectedMeta.title}</strong>
                  <span className="tag-pill">
                    {selectedMeta.dexNo} {selectedMeta.english}
                  </span>
                </div>
                <p>{selectedMeta.description}</p>
                <div className="fav-line">
                  进化路线：{selectedMeta.stageNames.baby} → {selectedMeta.stageNames.teen} →{' '}
                  {selectedMeta.stageNames.adult} · 最爱：<span>{favFood?.name}</span>
                </div>
                <div className="name-input-row">
                  <label htmlFor="pet-name-input">搭档昵称</label>
                  <input
                    id="pet-name-input"
                    type="text"
                    maxLength={12}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="输入昵称..."
                  />
                  <button
                    type="button"
                    className="pixel-btn secondary inline-icon-btn"
                    onClick={handleRandomName}
                  >
                    <PixelIcon name="dice" size={14} />
                    <span>随机</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="pixel-btn primary large"
                onClick={() => {
                  sound.play('confirm');
                  setStep('hatch');
                }}
              >
                拿起精灵球 → 召唤宝可梦！
              </button>
            </div>
          </>
        ) : (
          <div className="hatch-stage">
            <p className="hatch-tip">
              {taps < 3
                ? `点击摇晃的精灵球召唤「${name.trim() || selectedMeta.defaultName}」！（还需点击 ${3 - taps} 次）`
                : `出来吧！「${name.trim() || selectedMeta.defaultName}」！`}
            </p>

            <button
              type="button"
              className={`pixel-egg-btn ${shaking ? 'is-shaking' : ''}`}
              onClick={handlePokeballTap}
              disabled={taps >= 3}
            >
              {taps < 3 ? (
                <PixelItemImg src="/sprites/items/poke-ball.png" size={96} />
              ) : (
                <div className="hatched-reveal">
                  <PixelPetSprite species={species} stage="baby" size={112} />
                </div>
              )}
            </button>

            <div className="hatch-dots">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`hatch-dot ${taps > i ? 'done' : ''}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
