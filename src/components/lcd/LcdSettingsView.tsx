import type { LcdSharedCtx } from './lcdViewTypes';
import React, { useEffect } from 'react';
import { POKEDEX_ORDER, SHELL_THEMES } from '../../data/catalog';
import { DEFAULT_GAME_PREFS, type EnemyDisplayMode, type GamePrefs, type GraphicsQualityMode, type KeyBindings, ShellThemeId } from '../../types/pet';
import { DEFAULT_KEY_BINDINGS } from '../../utils/petEngine';
import { resetDevGrants, setDevGrants, useDevGrants, useDevMode } from '../../utils/devMode';
import { sound } from '../../utils/sound';
import { getTemperatureBand, getWeatherIntensityOptions, hasWeatherIntensity, type WeatherKind } from '../../utils/weatherSystem';
import { PixelIcon, PixelItemImg } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdSettingsView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { connectedGamepadName, isFullscreen, keysSubTab, mode, onDevGrantCoins99999, onDevGrantItems99, onDevGrantPokeballs99, onDevGrantStardust99999, onGoBack, onToggleFullscreen, onUpdateSettings, rebindingAction, save, setKeysSubTab, setRebindingAction, setSettingsTab, settingsTab } = ctx;
  const [devMode, setDevMode] = useDevMode();
  const [devGrants] = useDevGrants();

  useEffect(() => {
    if (!devMode && settingsTab === 'debug') {
      setSettingsTab('audio');
    }
  }, [devMode, settingsTab, setSettingsTab]);

  return (
    <>
        {mode === 'settings' && (() => {
          const cryOn = save.cryEnabled ?? true;
          const cryVol = save.cryVolume ?? 60;
          const combatSfxOn = save.combatSfxEnabled ?? true;
          const prefs: GamePrefs = { ...DEFAULT_GAME_PREFS, ...(save.prefs ?? {}) };
          const setPref = (p: Partial<GamePrefs>) => onUpdateSettings({ prefs: p });
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="lcd-subtabs is-settings-tabs">
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'audio' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('audio');
                    }}
                  >
                    <PixelIcon name="sound_on" size={11} />
                    <span>音频</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'hud' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('hud');
                    }}
                  >
                    <PixelIcon name="trophy" size={11} />
                    <span>界面</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'perf' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('perf');
                    }}
                  >
                    <PixelIcon name="bolt" size={11} />
                    <span>画面</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'style' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('style');
                    }}
                  >
                    <PixelIcon name="sparkle" size={11} />
                    <span>外观</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'keys' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('keys')}
                  >
                    <PixelIcon name="gamepad" size={11} />
                    <span>按键</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'world' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('world');
                    }}
                  >
                    <PixelIcon name="house" size={11} />
                    <span>世界</span>
                  </button>
                  {devMode && (
                    <button
                      type="button"
                      className={`lcd-subtab inline-icon-btn is-debug-tab ${settingsTab === 'debug' ? 'active' : ''}`}
                      onClick={() => {
                        setRebindingAction(null);
                        setSettingsTab('debug');
                      }}
                    >
                      <PixelIcon name="bulb" size={11} />
                      <span>调试</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    sound.play('cancel');
                    setRebindingAction(null);
                    onGoBack();
                  }}
                >
                  返回
                </button>
              </div>

              <div className="settings-stack scroll-y">
                {settingsTab === 'audio' && (
                  <div className="settings-grid-2">
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>总音量</strong>
                        <em className="vol-pill">{prefs.masterVolume}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={prefs.masterVolume}
                        style={{ '--val': `${prefs.masterVolume}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ masterVolume: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>音乐</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${save.bgmEnabled ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ bgmEnabled: !save.bgmEnabled })}
                          >
                            {save.bgmEnabled ? '开' : '关'}
                          </button>
                          <em className="vol-pill">{save.bgmVolume}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={save.bgmVolume}
                        style={{ '--val': `${save.bgmVolume}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ bgmEnabled: true, bgmVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>效果音</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${!save.muted ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ muted: !save.muted })}
                          >
                            {save.muted ? '关' : '开'}
                          </button>
                          <em className="vol-pill">{save.sfxVolume}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={save.sfxVolume}
                        style={{ '--val': `${save.sfxVolume}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ muted: false, sfxVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>环境音效</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${(prefs.ambientEnabled ?? true) ? 'is-on' : ''}`}
                            onClick={() => setPref({ ambientEnabled: !(prefs.ambientEnabled ?? true) })}
                          >
                            {(prefs.ambientEnabled ?? true) ? '开' : '关'}
                          </button>
                          <em className="vol-pill">{prefs.ambientVolume ?? 68}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={0}
                        max={100}
                        step={5}
                        value={prefs.ambientVolume ?? 68}
                        style={{ '--val': `${prefs.ambientVolume ?? 68}%` } as React.CSSProperties}
                        onChange={(e) =>
                          setPref({ ambientEnabled: true, ambientVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>宝可梦叫声</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${cryOn ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ cryEnabled: !cryOn })}
                          >
                            {cryOn ? '开' : '关'}
                          </button>
                          <em className="vol-pill">{cryVol}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-pink"
                        min={0}
                        max={100}
                        step={5}
                        value={cryVol}
                        style={{ '--val': `${cryVol}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ cryEnabled: true, cryVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>后台时静音</strong>
                          <small className="audio-track-hint">切换标签页自动静音</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.muteOnBlur ? 'is-on' : ''}`}
                          onClick={() => setPref({ muteOnBlur: !prefs.muteOnBlur })}
                        >
                          {prefs.muteOnBlur ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>战斗技能音效</strong>
                          <small className="audio-track-hint">释放 / 击中 / 击败音效</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${combatSfxOn ? 'is-on' : ''}`}
                          onClick={() => onUpdateSettings({ combatSfxEnabled: !combatSfxOn })}
                        >
                          {combatSfxOn ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'hud' && (
                  <div className="settings-grid-2">
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>界面大小</strong>
                        <em className="vol-pill">{prefs.hudScale}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={75}
                        max={125}
                        step={5}
                        value={prefs.hudScale}
                        style={{ '--val': `${((prefs.hudScale - 75) / 50) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ hudScale: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>界面不透明度</strong>
                        <em className="vol-pill">{prefs.hudOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={40}
                        max={100}
                        step={5}
                        value={prefs.hudOpacity}
                        style={{ '--val': `${((prefs.hudOpacity - 40) / 60) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ hudOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>首领血条不透明度</strong>
                        <em className="vol-pill">{prefs.bossBarOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={35}
                        max={100}
                        step={5}
                        value={prefs.bossBarOpacity}
                        style={{ '--val': `${((prefs.bossBarOpacity - 35) / 65) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ bossBarOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>首领体力显示</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`lcd-subtab ${prefs.bossHpMode === 'hp' ? 'active' : ''}`}
                            onClick={() => setPref({ bossHpMode: 'hp' })}
                          >
                            HP
                          </button>
                          <button
                            type="button"
                            className={`lcd-subtab ${prefs.bossHpMode === 'pct' ? 'active' : ''}`}
                            onClick={() => setPref({ bossHpMode: 'pct' })}
                          >
                            百分比
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>大号横幅提示</strong>
                          <small className="audio-track-hint">事件 / 收服醒目横幅</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.largeBanners ? 'is-on' : ''}`}
                          onClick={() => setPref({ largeBanners: !prefs.largeBanners })}
                        >
                          {prefs.largeBanners ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>首领机制提示</strong>
                          <small className="audio-track-hint">狂暴与弹幕阶段预警</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.bossAlerts ? 'is-on' : ''}`}
                          onClick={() => setPref({ bossAlerts: !prefs.bossAlerts })}
                        >
                          {prefs.bossAlerts ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>伤害数字</strong>
                          <small className="audio-track-hint">战斗飘字伤害统计</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showDamageNumbers ? 'is-on' : ''}`}
                          onClick={() => setPref({ showDamageNumbers: !prefs.showDamageNumbers })}
                        >
                          {prefs.showDamageNumbers ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>连续击败</strong>
                          <small className="audio-track-hint">显示右侧连续击败徽章</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showComboCounter ? 'is-on' : ''}`}
                          onClick={() => setPref({ showComboCounter: !prefs.showComboCounter })}
                        >
                          {prefs.showComboCounter ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'perf' && (
                  <div className="settings-grid-2">
                    <div className="settings-card is-span-2">
                      <div className="settings-card-head is-stacked">
                        <div>
                          <strong>3D 镜头视角模式</strong>
                          <small className="audio-track-hint">户外四档视角任选，进入室内或高架桥下时自动平滑缩放推进</small>
                        </div>
                        <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                          {(
                            [
                              ['hd2d', 'HD-2D俯视'],
                              ['chase', '自动追尾'],
                              ['free', '自由环绕'],
                              ['overhead', '高空鸟瞰'],
                            ] as const
                          ).map(([cId, cLbl]) => (
                            <button
                              key={cId}
                              type="button"
                              className={`lcd-subtab ${(prefs.cameraFollowMode ?? 'hd2d') === cId ? 'active' : ''}`}
                              onClick={() => {
                                sound.play('cursor');
                                setPref({ cameraFollowMode: cId });
                              }}
                            >
                              {cLbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {onToggleFullscreen && (
                      <div className="settings-card">
                        <div className="settings-card-head">
                          <div>
                            <strong>全屏模式</strong>
                            <small className="audio-track-hint">切换网站浏览器全屏</small>
                          </div>
                          <button
                            type="button"
                            className={`px-switch ${isFullscreen ? 'is-on' : ''}`}
                            onClick={onToggleFullscreen}
                          >
                            {isFullscreen ? '开' : '关'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>画质品质</strong>
                        <div className="inline-icon-row">
                          {(['high', 'medium', 'low'] as GraphicsQualityMode[]).map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={`lcd-subtab ${prefs.graphicsQuality === q ? 'active' : ''}`}
                              onClick={() => setPref({ graphicsQuality: q })}
                            >
                              {q === 'high' ? '高' : q === 'medium' ? '中' : '低'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>省电模式</strong>
                          <small className="audio-track-hint">限 30 帧并降低分辨率</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.powerSaver ? 'is-on' : ''}`}
                          onClick={() => setPref({ powerSaver: !prefs.powerSaver })}
                        >
                          {prefs.powerSaver ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card is-span-2">
                      <div className="settings-card-head is-stacked">
                        <strong>帧率上限</strong>
                        <div className="inline-icon-row">
                          {([0, 30, 60, 90, 120] as const).map((cap) => (
                            <button
                              key={cap}
                              type="button"
                              className={`lcd-subtab ${prefs.fpsLimit === cap ? 'active' : ''}`}
                              onClick={() => setPref({ fpsLimit: cap })}
                            >
                              {cap === 0 ? '无限制' : cap}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>屏幕震动</strong>
                        <button
                          type="button"
                          className={`px-switch ${prefs.screenShake ? 'is-on' : ''}`}
                          onClick={() => setPref({ screenShake: !prefs.screenShake })}
                        >
                          {prefs.screenShake ? '开' : '关'}
                        </button>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={0}
                        max={100}
                        step={10}
                        value={prefs.shakeIntensity}
                        style={{ '--val': `${prefs.shakeIntensity}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ shakeIntensity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>特效不透明度</strong>
                        <em className="vol-pill">{prefs.vfxOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={20}
                        max={100}
                        step={5}
                        value={prefs.vfxOpacity}
                        style={{ '--val': `${((prefs.vfxOpacity - 20) / 80) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ vfxOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>我方攻击不透明度</strong>
                        <em className="vol-pill">{prefs.playerAttackOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={15}
                        max={100}
                        step={5}
                        value={prefs.playerAttackOpacity}
                        style={{ '--val': `${((prefs.playerAttackOpacity - 15) / 85) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ playerAttackOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>隐藏我方攻击</strong>
                          <small className="audio-track-hint">弹幕过多时提升视野</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.hidePlayerAttacks ? 'is-on' : ''}`}
                          onClick={() => setPref({ hidePlayerAttacks: !prefs.hidePlayerAttacks })}
                        >
                          {prefs.hidePlayerAttacks ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card is-span-2">
                      <div className="settings-card-head is-stacked">
                        <strong>显示的敌人</strong>
                        <div className="inline-icon-row">
                          {(
                            [
                              ['all', '全部'],
                              ['near', '附近'],
                              ['very_near', '非常近'],
                              ['shadow_only', '只显示阴影'],
                            ] as [EnemyDisplayMode, string][]
                          ).map(([val, lbl]) => (
                            <button
                              key={val}
                              type="button"
                              className={`lcd-subtab ${prefs.enemyDisplayMode === val ? 'active' : ''}`}
                              onClick={() => setPref({ enemyDisplayMode: val })}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>减少闪光</strong>
                          <small className="audio-track-hint">柔和过场与光效</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.reduceFlashes ? 'is-on' : ''}`}
                          onClick={() => setPref({ reduceFlashes: !prefs.reduceFlashes })}
                        >
                          {prefs.reduceFlashes ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>显示 FPS</strong>
                          <small className="audio-track-hint">实时帧率监测</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showFps ? 'is-on' : ''}`}
                          onClick={() => setPref({ showFps: !prefs.showFps })}
                        >
                          {prefs.showFps ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {settingsTab === 'style' && (
                <div className="settings-card">
                  <div className="settings-card-title">样式与显示模式</div>
                  <div className="settings-row">
                    <span>画面显示模式</span>
                    <div className="inline-icon-row">
                      <button
                        type="button"
                        className={`lcd-subtab ${save.showShell ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ showShell: true })}
                      >
                        掌机外壳
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab ${!save.showShell ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ showShell: false })}
                      >
                        全屏模式
                      </button>
                    </div>
                  </div>
                  <div className="settings-row col">
                    <span>掌机外壳涂装颜色</span>
                    <div className="shell-swatch-grid">
                      {(
                        [
                          ['pikachu_yellow', '皮卡黄'],
                          ['pokeball_red', '精灵红'],
                          ['crystal_blue', '水晶蓝'],
                          ['gengar_purple', '耿鬼紫'],
                        ] as [ShellThemeId, string][]
                      ).map(([id, shortLabel]) => {
                        const th = SHELL_THEMES[id];
                        const active = save.shellTheme === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`shell-swatch-btn ${active ? 'active' : ''}`}
                            onClick={() => onUpdateSettings({ shellTheme: id })}
                            title={th.name}
                          >
                            <span
                              className="lcd-shell-dot"
                              style={{ backgroundColor: th.body }}
                            />
                            <span>{shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'world' && (
                <div className="settings-stack scroll-y">
                  <div className="settings-card">
                    <div className="settings-card-head is-stacked">
                      <div>
                        <strong>世界难度</strong>
                        <small>实时调整野外遭遇宝可梦的挑战强度</small>
                      </div>
                      <div className="inline-icon-row">
                        {(
                          [
                            ['normal', '普通', 'sprout'],
                            ['hard', '困难', 'sword'],
                            ['nightmare', '噩梦', 'fire'],
                          ] as const
                        ).map(([id, lbl, iconName]) => (
                          <button
                            key={id}
                            type="button"
                            className={`lcd-subtab inline-icon-btn ${(prefs.worldDifficulty ?? 'normal') === id ? 'active' : ''}`}
                            onClick={() => {
                              sound.play('cursor');
                              setPref({ worldDifficulty: id });
                            }}
                          >
                            <PixelIcon name={iconName} size={11} />
                            <span>{lbl}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'debug' && devMode && (
                <div className="settings-stack scroll-y">
                  <div className="settings-card is-debug-banner">
                    <div className="settings-card-head">
                      <div>
                        <strong>开发者调试模式已开启</strong>
                        <small>用于调试验证昼夜光影、实时天气与性能指标（仅开发/调试态可见）</small>
                      </div>
                      <div className="inline-icon-row">
                        <button
                          type="button"
                          className="lcd-subtab"
                          onClick={() => {
                            sound.play('cursor');
                            setPref({
                              worldTimeMode: 'auto',
                              worldWeatherMode: 'auto',
                              worldWeatherIntensity: 'moderate',
                              worldTempMode: 'auto',
                            });
                          }}
                        >
                          恢复实时
                        </button>
                        <button
                          type="button"
                          className="lcd-mini-close"
                          onClick={() => {
                            sound.play('cancel');
                            setDevMode(false);
                            setSettingsTab('audio');
                          }}
                        >
                          退出调试
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-head is-stacked">
                      <div>
                        <strong>昼夜与日出日落时间</strong>
                        <small>默认按当前经纬度实时计算天文日出日落与光影，调试模式下可手动锁定预览</small>
                      </div>
                      <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                        {(
                          [
                            ['auto', '经纬度实时日出日落', 'clock'],
                            ['day', '白天', 'sun'],
                            ['dusk', '黄昏', 'sunset'],
                            ['night', '夜晚', 'moon'],
                          ] as const
                        ).map(([tId, tLbl, tIcon]) => (
                          <button
                            key={tId}
                            type="button"
                            className={`lcd-subtab inline-icon-btn ${(prefs.worldTimeMode ?? 'auto') === tId ? 'active' : ''}`}
                            onClick={() => {
                              sound.play('cursor');
                              setPref({ worldTimeMode: tId });
                            }}
                          >
                            <PixelIcon name={tIcon} size={11} />
                            <span>{tLbl}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-head is-stacked">
                      <div>
                        <strong>世界天气与属性加成</strong>
                        <small>默认按当前定位城市同步实时气象，调试模式下可手动切换天气及对应程度</small>
                      </div>
                      <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                        {(
                          [
                            ['auto', '自动实时', 'sparkle'],
                            ['clear', '晴朗', 'weather_clear'],
                            ['cloudy', '阴天', 'weather_cloudy'],
                            ['rain', '下雨', 'weather_rain'],
                            ['storm', '雷雨', 'weather_storm'],
                            ['hail', '冰雹', 'weather_hail'],
                            ['snow', '下雪', 'weather_snow'],
                            ['windy', '强风', 'weather_windy'],
                          ] as const
                        ).map(([wId, wLbl, wIcon]) => (
                          <button
                            key={wId}
                            type="button"
                            className={`lcd-subtab inline-icon-btn ${(prefs.worldWeatherMode ?? 'auto') === wId ? 'active' : ''}`}
                            onClick={() => {
                              sound.play('cursor');
                              setPref({ worldWeatherMode: wId });
                            }}
                          >
                            <PixelIcon name={wIcon} size={11} />
                            <span>{wLbl}</span>
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const activeMode = prefs.worldWeatherMode ?? 'auto';
                        if (activeMode === 'auto') return null;
                        const wKind = activeMode as WeatherKind;
                        if (!hasWeatherIntensity(wKind)) {
                          return (
                            <div className="weather-intensity-subrow">
                              <small className="weather-intensity-note">
                                晴朗无程度层级，可在下方「世界环境温度」单独调节温度
                              </small>
                            </div>
                          );
                        }
                        const options = getWeatherIntensityOptions(wKind);
                        const curIntensity = prefs.worldWeatherIntensity ?? 'moderate';
                        const activeOpt = options.find((o) => o.id === curIntensity) ?? options[1];
                        return (
                          <div className="weather-intensity-subrow">
                            <div className="weather-intensity-head">
                              <span>天气程度</span>
                              <small>{activeOpt?.hint}</small>
                            </div>
                            <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                              {options.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  className={`lcd-subtab ${curIntensity === opt.id ? 'active' : ''}`}
                                  onClick={() => {
                                    sound.play('cursor');
                                    setPref({ worldWeatherIntensity: opt.id });
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {(() => {
                    const tempMode = prefs.worldTempMode ?? 'auto';
                    const tempVal = Math.max(-25, Math.min(45, Math.round(prefs.worldTempC ?? 22)));
                    const band = getTemperatureBand(tempVal);
                    const sliderPct = ((tempVal - -25) / 70) * 100;
                    const rangeClass =
                      tempVal <= 10 ? 'is-blue' : tempVal >= 31 ? 'is-red' : 'is-amber';
                    const presets = [
                      { label: '极寒', val: -15 },
                      { label: '严寒', val: 0 },
                      { label: '凉爽', val: 12 },
                      { label: '舒适', val: 22 },
                      { label: '炎热', val: 32 },
                      { label: '酷暑', val: 40 },
                    ];
                    return (
                      <div className="settings-card">
                        <div className="settings-card-head is-stacked">
                          <div className="temp-card-top">
                            <div>
                              <strong className="inline-icon-row" style={{ gap: 5 }}>
                                <PixelIcon name="thermometer" size={12} />
                                <span>世界环境温度</span>
                              </strong>
                              <small>
                                独立于天气类型单独调整，影响冷暖光影、零下结霜与极端温差属性加成
                              </small>
                            </div>
                            <div className="inline-icon-row">
                              <button
                                type="button"
                                className={`lcd-subtab ${tempMode === 'auto' ? 'active' : ''}`}
                                onClick={() => {
                                  sound.play('cursor');
                                  setPref({ worldTempMode: 'auto' });
                                }}
                              >
                                自动实时
                              </button>
                              <button
                                type="button"
                                className={`lcd-subtab ${tempMode === 'manual' ? 'active' : ''}`}
                                onClick={() => {
                                  sound.play('cursor');
                                  setPref({ worldTempMode: 'manual', worldTempC: tempVal });
                                }}
                              >
                                手动调节
                              </button>
                            </div>
                          </div>

                          <div className="temp-control-body">
                            <div className="temp-status-row">
                              <span
                                className="temp-readout-pill"
                                style={{ backgroundColor: tempMode === 'manual' ? band.color : '#868e96' }}
                              >
                                {tempMode === 'manual'
                                  ? `${tempVal}°C · ${band.label}`
                                  : '跟随当前天气温度'}
                              </span>
                              <small className="temp-buff-hint">
                                {tempMode === 'manual'
                                  ? (band.buffHint ?? '体感宜人，无极端温差修正')
                                  : '拖动滑块或点选预设将切换为手动温度'}
                              </small>
                            </div>

                            <input
                              type="range"
                              className={`pkb-range ${rangeClass}`}
                              min={-25}
                              max={45}
                              step={1}
                              value={tempVal}
                              style={{ '--val': `${sliderPct}%` } as React.CSSProperties}
                              onChange={(e) =>
                                setPref({
                                  worldTempMode: 'manual',
                                  worldTempC: Number(e.target.value),
                                })
                              }
                            />
                            <div className="temp-scale-ticks">
                              <span>-25°C 极寒</span>
                              <span>0°C 冰点</span>
                              <span>22°C 舒适</span>
                              <span>45°C 酷暑</span>
                            </div>

                            <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                              {presets.map((p) => (
                                <button
                                  key={p.val}
                                  type="button"
                                  className={`lcd-subtab ${tempMode === 'manual' && tempVal === p.val ? 'active' : ''}`}
                                  onClick={() => {
                                    sound.play('cursor');
                                    setPref({ worldTempMode: 'manual', worldTempC: p.val });
                                  }}
                                >
                                  {p.label} {p.val}°C
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="settings-card">
                    <div className="settings-card-head">
                      <div>
                        <strong>调试控制中心</strong>
                        <small>快捷开关（可回退）与一键资源补给</small>
                      </div>
                      <div className="inline-icon-row">
                        <button
                          type="button"
                          className="lcd-subtab"
                          onClick={() => {
                            sound.play('levelup');
                            setDevGrants({
                              allPets: true,
                              allPokedex: true,
                              allItems: true,
                              allPokeballs: true,
                              allLabUpgrades: true,
                              allBadges: true,
                              infiniteStardust: true,
                              infiniteCoins: true,
                              mapTeleport: true,
                            });
                          }}
                        >
                          全部开启
                        </button>
                        <button
                          type="button"
                          className="lcd-mini-close"
                          onClick={() => {
                            sound.play('cancel');
                            resetDevGrants();
                          }}
                        >
                          全部回退
                        </button>
                      </div>
                    </div>

                    {/* 5x2 Quick Toggle Switches Grid (Mobile Control Center Style) */}
                    <div className="debug-cc-grid is-5">
                      <div
                        className={`debug-cc-tile ${devGrants.allPets ? 'is-active' : ''}`}
                        title={`临时解锁全 ${POKEDEX_ORDER.length} 种精灵用于编队与体验，关闭即回退`}
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/poke-ball.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">全精灵</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allPets ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.allPets;
                            sound.play(next ? 'levelup' : 'cancel');
                            setDevGrants({ allPets: next });
                          }}
                        >
                          {devGrants.allPets ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.allPokedex || devGrants.allPets ? 'is-active' : ''}`}
                        title="条件状态：开启即视为全图鉴解锁，关闭后恢复真实图鉴（保留期间正常捕获的精灵）"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/town-map.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">全图鉴</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allPokedex || devGrants.allPets ? 'is-on' : ''}`}
                          disabled={devGrants.allPets}
                          onClick={() => {
                            const next = !devGrants.allPokedex;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ allPokedex: next });
                          }}
                        >
                          {devGrants.allPokedex || devGrants.allPets ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.allLabUpgrades ? 'is-active' : ''}`}
                        title="临时满级解锁全部研究所强化、主角与专属觉醒技能，关闭即还原真实进度"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/life-orb.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">全强化</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allLabUpgrades ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.allLabUpgrades;
                            sound.play(next ? 'levelup' : 'cancel');
                            setDevGrants({ allLabUpgrades: next });
                          }}
                        >
                          {devGrants.allLabUpgrades ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.allBadges ? 'is-active' : ''}`}
                        title="临时解锁全部道馆与荣誉徽章及对应训练师头衔，关闭即还原真实进度"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/kings-rock.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">全徽章</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allBadges ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.allBadges;
                            sound.play(next ? 'levelup' : 'cancel');
                            setDevGrants({ allBadges: next });
                          }}
                        >
                          {devGrants.allBadges ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.mapTeleport ? 'is-active' : ''}`}
                        title="开启后在地图选点下方及导航列表中显示「传送」按钮，点击直接瞬移抵达"
                      >
                        <div className="debug-cc-ico">
                          <PixelIcon name="bolt" size={24} />
                        </div>
                        <strong className="debug-cc-name">地图传送</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.mapTeleport ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.mapTeleport;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ mapTeleport: next });
                          }}
                        >
                          {devGrants.mapTeleport ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.allItems ? 'is-active' : ''}`}
                        title="开启后所有树果与携带道具无限使用不消耗，关闭即还原真实库存"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/berry-pouch.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">无限道具</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allItems ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.allItems;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ allItems: next });
                          }}
                        >
                          {devGrants.allItems ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.allPokeballs ? 'is-active' : ''}`}
                        title="开启后解锁全部 9 种精灵球（含大师球）且无限使用，关闭即还原"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/ultra-ball.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">无限精灵球</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.allPokeballs ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.allPokeballs;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ allPokeballs: next });
                          }}
                        >
                          {devGrants.allPokeballs ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.infiniteStardust ? 'is-active' : ''}`}
                        title="开启后星沙无限使用不消耗，关闭即还原真实星沙数量"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/bright-powder.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">无限星沙</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.infiniteStardust ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.infiniteStardust;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ infiniteStardust: next });
                          }}
                        >
                          {devGrants.infiniteStardust ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${devGrants.infiniteCoins ? 'is-active' : ''}`}
                        title="开启后金币无限使用不消耗，关闭即还原真实金币数量"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/amulet-coin.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">无限金币</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${devGrants.infiniteCoins ? 'is-on' : ''}`}
                          onClick={() => {
                            const next = !devGrants.infiniteCoins;
                            sound.play(next ? 'confirm' : 'cancel');
                            setDevGrants({ infiniteCoins: next });
                          }}
                        >
                          {devGrants.infiniteCoins ? '开' : '关'}
                        </button>
                      </div>

                      <div
                        className={`debug-cc-tile ${prefs.showFps ? 'is-active' : ''}`}
                        title="在 3D 画面左下角实时监控帧率"
                      >
                        <div className="debug-cc-ico">
                          <PixelIcon name="chart" size={24} />
                        </div>
                        <strong className="debug-cc-name">FPS 浮窗</strong>
                        <button
                          type="button"
                          className={`px-switch debug-cc-sw ${prefs.showFps ? 'is-on' : ''}`}
                          onClick={() => setPref({ showFps: !prefs.showFps })}
                        >
                          {prefs.showFps ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    {/* 4x1 One-Click Resource Fill Buttons */}
                    <div className="debug-cc-grid is-4-actions">
                      <div
                        className="debug-cc-tile is-action"
                        title="点击将全部树果与携带道具补满至至少 99 个"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/oran-berry.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">获取道具</strong>
                        <button
                          type="button"
                          className="debug-cc-btn"
                          onClick={() => onDevGrantItems99?.()}
                        >
                          ×99 获取
                        </button>
                      </div>

                      <div
                        className="debug-cc-tile is-action"
                        title="点击将全部 9 种精灵球（含大师球）补满至至少 99 个"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/master-ball.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">获取精灵球</strong>
                        <button
                          type="button"
                          className="debug-cc-btn"
                          onClick={() => onDevGrantPokeballs99?.()}
                        >
                          ×99 获取
                        </button>
                      </div>

                      <div
                        className="debug-cc-tile is-action"
                        title="点击将星沙数量补满至至少 99999"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/bright-powder.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">获取星沙</strong>
                        <button
                          type="button"
                          className="debug-cc-btn"
                          onClick={() => onDevGrantStardust99999?.()}
                        >
                          99999
                        </button>
                      </div>

                      <div
                        className="debug-cc-tile is-action"
                        title="点击将宝可币数量补满至至少 99999"
                      >
                        <div className="debug-cc-ico">
                          <PixelItemImg src="/sprites/items/amulet-coin.png" size={30} />
                        </div>
                        <strong className="debug-cc-name">获取金币</strong>
                        <button
                          type="button"
                          className="debug-cc-btn"
                          onClick={() => onDevGrantCoins99999?.()}
                        >
                          99999
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'keys' && (
                <div className="keys-split-shell">
                  <aside className="keys-side-tabs" aria-label="输入设备切换">
                    <button
                      type="button"
                      className={`keys-side-tab ${keysSubTab === 'keyboard' ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setKeysSubTab('keyboard');
                      }}
                    >
                      <span>⌨</span>
                      <strong>键盘</strong>
                    </button>
                    {connectedGamepadName && (
                      <button
                        type="button"
                        className={`keys-side-tab ${keysSubTab === 'gamepad' ? 'active' : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setRebindingAction(null);
                          setKeysSubTab('gamepad');
                        }}
                      >
                        <PixelIcon name="gamepad" size={13} />
                        <strong>手柄</strong>
                      </button>
                    )}
                  </aside>

                  <div className="settings-card keys-main-pane">
                    {keysSubTab === 'keyboard' || !connectedGamepadName ? (
                      <>
                        <div className="settings-row">
                          <span className="settings-card-title">按键映射（支持全屏键盘操作）</span>
                          <button
                            type="button"
                            className="lcd-subtab"
                            onClick={() => {
                              setRebindingAction(null);
                              onUpdateSettings({ keyBindings: { ...DEFAULT_KEY_BINDINGS } });
                            }}
                          >
                            恢复默认
                          </button>
                        </div>
                        <div className="keybind-grid">
                          {(
                            [
                              ['up', '方向 · 上'],
                              ['down', '方向 · 下'],
                              ['left', '方向 · 左'],
                              ['right', '方向 · 右'],
                              ['confirm', '确认 (A键)'],
                              ['cancel', '返回 (B键)'],
                              ['menu', '菜单 (START)'],
                              ['party', '球盒 (SELECT)'],
                            ] as [keyof KeyBindings, string][]
                          ).map(([actionKey, label]) => {
                            const raw = (save.keyBindings ?? DEFAULT_KEY_BINDINGS)[actionKey];
                            const display =
                              raw === ' '
                                ? 'SPACE'
                                : raw === 'Escape'
                                  ? 'ESC'
                                  : raw === 'Enter'
                                    ? 'ENTER'
                                    : raw.toUpperCase();
                            const isListening = rebindingAction === actionKey;
                            return (
                              <div key={actionKey} className="keybind-item">
                                <span>{label}</span>
                                <button
                                  type="button"
                                  className={`keybind-btn ${isListening ? 'is-listening' : ''}`}
                                  onClick={() =>
                                    setRebindingAction(isListening ? null : actionKey)
                                  }
                                >
                                  {isListening ? '请按键...' : display}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="keybind-section-title">3D 冒险与战斗全快捷键一览</div>
                        <div className="keybind-ref-grid">
                          {(
                            [
                              ['移动（360°）', 'WASD / 方向键'],
                              ['3D 跳跃 / 飞行爬升', 'SPACE'],
                              ['冲刺加速', 'SHIFT'],
                              ['交互 / 触发事件 / 收服倒地', 'E'],
                              ['切换交互选项', 'TAB'],
                              ['打开世界大地图', 'M / ` / N'],
                              ['打开队伍列表', 'L'],
                              ['打开战术终端', 'P / Q'],
                              ['打开球舱养成', 'F'],
                              ['打开训练家菜单', 'ESC'],
                              ['投掷精灵球（捕捉精灵）', 'K'],
                              ['使用好伤药', 'V / H'],
                              ['激活力量强化', 'B'],
                              ['全队满蓝齐射', 'U'],
                              ['切换 3D 镜头视角', 'G'],
                              ['复位 3D 视角', 'R'],
                              ['切换骑乘 / 飞行', 'T'],
                              ['左右旋转视角', 'Z / C / [ / ]'],
                              ['飞行下降', 'X / CTRL'],
                              ['安全区治疗 / 商店', '1 / 2'],
                              ['视角拖拽 / 缩放', '鼠标拖动 / 滚轮'],
                              ['释放鼠标锁定', 'ALT'],
                            ] as const
                          ).map(([desc, keys]) => (
                            <div key={desc} className="keybind-ref-item">
                              <span>{desc}</span>
                              <kbd>{keys}</kbd>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="gamepad-guide-box is-tab-pane">
                        <div className="gamepad-guide-head">
                          <div className="inline-icon-row">
                            <PixelIcon name="gamepad" size={14} />
                            <strong>手柄即插即用映射</strong>
                          </div>
                          <span className="gamepad-status-pill is-connected">
                            已连接：{connectedGamepadName.slice(0, 22)}
                          </span>
                        </div>
                        <div className="gamepad-map-grid">
                          <div><b>左摇杆 / 十字键</b><span>360° 移动</span></div>
                          <div><b>右摇杆</b><span>自由旋转视角</span></div>
                          <div><b>A / ✕</b><span>跳跃</span></div>
                          <div><b>X / □</b><span>投掷精灵球</span></div>
                          <div><b>B / ○</b><span>使用伤药</span></div>
                          <div><b>Y / △</b><span>力量强化</span></div>
                          <div><b>RB / R1</b><span>全队齐射</span></div>
                          <div><b>LB / L1</b><span>展开大地图</span></div>
                          <div><b>START</b><span>训练家菜单</span></div>
                          <div><b>SELECT</b><span>视角复位</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}

    </>
  );
};
