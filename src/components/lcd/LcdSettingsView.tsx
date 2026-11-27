import type { LcdSharedCtx } from './lcdViewTypes';
import React, { useEffect } from 'react';
import { SHELL_THEMES } from '../../data/catalog';
import { DEFAULT_GAME_PREFS, type EnemyDisplayMode, type GamePrefs, type GraphicsQualityMode, type KeyBindings, ShellThemeId } from '../../types/pet';
import { DEFAULT_KEY_BINDINGS } from '../../utils/petEngine';
import { useDevMode } from '../../utils/devMode';
import { sound } from '../../utils/sound';
import { PixelIcon } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdSettingsView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { connectedGamepadName, isFullscreen, keysSubTab, mode, onCloseHandheldTo3D, onNavigateMode, onToggleFullscreen, onUpdateSettings, openedEntryMode, openedFromBattle, rebindingAction, save, setKeysSubTab, setRebindingAction, setSettingsTab, settingsTab } = ctx;
  const [devMode, setDevMode] = useDevMode();

  useEffect(() => {
    if (!devMode && settingsTab === 'debug') {
      setSettingsTab('audio');
    }
  }, [devMode, settingsTab, setSettingsTab]);

  return (
    <>
        {mode === 'settings' && (() => {
          const directOpened = openedEntryMode === 'settings' && Boolean(onCloseHandheldTo3D);
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
                  className={`lcd-mini-close ${directOpened && openedFromBattle ? 'is-resume inline-icon-row' : ''}`}
                  onClick={() => {
                    setRebindingAction(null);
                    if (directOpened && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {directOpened && openedFromBattle && <PixelIcon name="play" size={10} />}
                  <span>{directOpened ? (openedFromBattle ? '继续战斗' : '关闭') : '返回'}</span>
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
                            setPref({ worldTimeMode: 'auto', worldWeatherMode: 'auto' });
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
                        <small>默认按当前定位城市同步实时气象，调试模式下可手动切换验证天气与加成效果</small>
                      </div>
                      <div className="inline-icon-row" style={{ flexWrap: 'wrap' }}>
                        {(
                          [
                            ['auto', '自动实时', 'sparkle'],
                            ['clear', '晴朗', 'weather_clear'],
                            ['cloudy', '阴天', 'weather_cloudy'],
                            ['rain', '下雨', 'weather_rain'],
                            ['storm', '雷雨', 'weather_storm'],
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
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-head">
                      <div>
                        <strong>显示 FPS 性能浮窗</strong>
                        <small>在 3D 画面左下角实时监控帧率</small>
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
