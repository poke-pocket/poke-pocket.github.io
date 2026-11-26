import type { LcdSharedCtx } from './lcdViewTypes';
import React from 'react';
import { POKEDEX_ORDER } from '../../data/catalog';
import { ensureFreshMetaProgress, getHeroDef } from '../../data/metaProgression';
import { DEFAULT_TRAINER_PROFILE } from '../../types/pet';
import { sound } from '../../utils/sound';
import { DEFAULT_ANNOUNCEMENTS } from '../MetaOverlays';
import { HandheldWorldMapView } from '../WorldMapHud';
import { PixelIcon, PixelItemImg } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdProfileMapNewsView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { feedbackSent, feedbackText, mode, newsPhotoIdx, onCloseHandheldTo3D, onNavigateMode, onUpdateSettings, openedEntryMode, save, selectedNewsId, setFeedbackSent, setFeedbackText, setNewsPhotoIdx, setSelectedNewsId, worldMapData } = ctx;
  return (
    <>
        {/* TRAINER PROFILE & SOCIAL CARD INSIDE HANDHELD */}
        {mode === 'profile' && (() => {
          const prof = { ...DEFAULT_TRAINER_PROFILE, ...(save.trainerProfile ?? {}) };
          const curMeta = ensureFreshMetaProgress(save.meta);
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="inline-icon-row">
                  <PixelIcon name="crown" size={14} />
                  <span>训练家名片与档案</span>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    if (openedEntryMode === 'profile' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {openedEntryMode === 'profile' ? '关闭' : '返回'}
                </button>
              </div>
              <div className="pkb-prof-body scroll-y">
                <div className="pkb-prof-preview">
                  <div className="pkb-prof-avatar-lg">
                    <PixelItemImg src={getHeroDef(curMeta.activeHero).avatarSprite} size={56} />
                  </div>
                  <div className="pkb-prof-stats">
                    <strong>{prof.name}</strong>
                    <span className="pkb-prof-title-badge">{prof.title}</span>
                    <p>{prof.bio}</p>
                    <div className="pkb-prof-kpis">
                      <span>图鉴 {save.discoveredSpecies.length}/{POKEDEX_ORDER.length}</span>
                      <span>伙伴 {save.pets.length} 只</span>
                      <span>道馆徽章 {(curMeta.unlockedBadges ?? []).length}/6</span>
                    </div>
                  </div>
                </div>
                <div className="pkb-prof-form">
                  <label>
                    <span>训练家昵称</span>
                    <input
                      type="text"
                      maxLength={14}
                      value={prof.name}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, name: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>展示称号</span>
                    <input
                      type="text"
                      maxLength={16}
                      value={prof.title}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, title: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>个人展示签名</span>
                    <input
                      type="text"
                      maxLength={36}
                      value={prof.bio}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, bio: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })()}

        {/* NATIVE HANDHELD TOWN MAP / FULL-BLEED REGIONAL TOPOGRAPHIC MAP (Zero top bar, floating drawer!) */}
        {mode === 'map' && (
          <div className="lcd-submenu is-fullbleed-map">
            {worldMapData ? (
              <HandheldWorldMapView
                data={worldMapData}
                closeLabel={openedEntryMode === 'map' ? '关闭' : '返回'}
                onClose={() => {
                  if (openedEntryMode === 'map' && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              />
            ) : (
              <div className="lcd-news-list scroll-y" style={{ padding: 12 }}>
                <div className="lcd-news-card">
                  <p>进入 3D 冒险原野后即可查看实时地形、湖泊水域与地点坐标！</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OFFICIAL ANNOUNCEMENTS & PATCH NOTES INSIDE HANDHELD (Click to view full detail!) */}
        {mode === 'news' && (() => {
          const activeNews = selectedNewsId
            ? DEFAULT_ANNOUNCEMENTS.find((n) => n.id === selectedNewsId) ?? null
            : null;
          const activePhotos = activeNews
            ? (activeNews.photos && activeNews.photos.length > 0
                ? activeNews.photos
                : activeNews.photo
                  ? [{ src: activeNews.photo, caption: activeNews.photoCaption ?? activeNews.title }]
                  : [])
            : [];
          const safePhotoIdx = activePhotos.length > 0 ? Math.min(newsPhotoIdx, activePhotos.length - 1) : 0;
          const curPhoto = activePhotos[safePhotoIdx] ?? null;
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
                  <span
                    className="lcd-submenu-head-title"
                    title={activeNews ? activeNews.title : '官方公告与版本更新'}
                  >
                    {activeNews ? activeNews.title : '官方公告与版本更新'}
                  </span>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    if (activeNews) {
                      setSelectedNewsId(null);
                      setNewsPhotoIdx(0);
                    } else if (openedEntryMode === 'news' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {activeNews ? '‹ 列表' : openedEntryMode === 'news' ? '关闭' : '返回'}
                </button>
              </div>
              {activeNews ? (
                <div className="lcd-news-detail scroll-y">
                  <div className="lcd-news-head">
                    <span className="lcd-news-tag">{activeNews.tag}</span>
                    {activeNews.reporter && <span className="lcd-news-reporter">{activeNews.reporter}</span>}
                    <em>{activeNews.date}</em>
                  </div>
                  {curPhoto && (
                    <figure className="lcd-news-photo-frame">
                      <img
                        src={curPhoto.src}
                        alt={curPhoto.caption}
                        className="lcd-news-photo-img"
                        draggable={false}
                      />
                      <span className="lcd-photo-stamp">
                        LIVE · PRESS {activePhotos.length > 1 ? `${safePhotoIdx + 1}/${activePhotos.length}` : ''}
                      </span>
                      <figcaption>📷 {curPhoto.caption}</figcaption>
                    </figure>
                  )}
                  {activePhotos.length > 1 && (
                    <div className="lcd-news-gallery-bar">
                      <div className="lcd-news-gallery-thumbs">
                        {activePhotos.map((ph, idx) => (
                          <button
                            key={ph.src}
                            type="button"
                            className={`lcd-news-thumb-btn ${idx === safePhotoIdx ? 'active' : ''}`}
                            title={`查看现场图 ${idx + 1}：${ph.caption}`}
                            onClick={() => {
                              sound.play('cursor');
                              setNewsPhotoIdx(idx);
                            }}
                          >
                            <img src={ph.src} alt={ph.caption} draggable={false} />
                          </button>
                        ))}
                      </div>
                      <div className="lcd-news-nav-btns">
                        <span className="lcd-news-photo-counter">
                          现场图 {safePhotoIdx + 1}/{activePhotos.length}
                        </span>
                        <button
                          type="button"
                          className="lcd-news-nav-btn"
                          aria-label="上一张现场照片"
                          onClick={() => {
                            sound.play('cursor');
                            setNewsPhotoIdx((prev) => (prev - 1 + activePhotos.length) % activePhotos.length);
                          }}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="lcd-news-nav-btn"
                          aria-label="下一张现场照片"
                          onClick={() => {
                            sound.play('cursor');
                            setNewsPhotoIdx((prev) => (prev + 1) % activePhotos.length);
                          }}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="lcd-news-detail-lead">{activeNews.body}</p>
                  {activeNews.details && activeNews.details.length > 0 && (
                    <ul className="lcd-news-bullets">
                      {activeNews.details.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="kanto-paper scroll-y">
                  {/* Classic Newspaper Masthead (报头) */}
                  <header className="paper-masthead">
                    <div className="paper-masthead-top">
                      <span>关都联盟官方特刊</span>
                      <strong>关 都 日 报</strong>
                      <span>KANTO DAILY</span>
                    </div>
                    <div className="paper-masthead-meta">
                      <span>关都历 11月26日 · 第 149 期</span>
                      <span>✈ 东亚 14 城巡礼 · 华夏限定色上线</span>
                      <span>点击任意报道阅读全文</span>
                    </div>
                  </header>

                  {/* Lead Front-Page Story (头版头条) */}
                  {DEFAULT_ANNOUNCEMENTS[0] && (() => {
                    const lead = DEFAULT_ANNOUNCEMENTS[0];
                    const photoCount = lead.photos?.length ?? (lead.photo ? 1 : 0);
                    return (
                      <article
                        className="paper-lead-story"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          sound.play('cursor');
                          setSelectedNewsId(lead.id);
                          setNewsPhotoIdx(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            sound.play('cursor');
                            setSelectedNewsId(lead.id);
                            setNewsPhotoIdx(0);
                          }
                        }}
                      >
                        <div className="paper-kicker-row">
                          <span className="paper-kicker is-red">头版头条 · {lead.tag}</span>
                          <span className="paper-byline">{lead.reporter ?? '关都日报记者'}</span>
                          <time>{lead.date}</time>
                        </div>
                        <h3 className="paper-lead-headline">{lead.title}</h3>
                        <div className="paper-lead-grid">
                          {lead.photo && (
                            <figure className="paper-lead-photo">
                              <img src={lead.photo} alt={lead.title} draggable={false} />
                              {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                            </figure>
                          )}
                          <div className="paper-lead-copy">
                            <p>{lead.body}</p>
                            <span className="paper-read-more">阅读头版全文 ›</span>
                          </div>
                        </div>
                      </article>
                    );
                  })()}

                  {/* Asymmetric Broadsheet Editorial Mosaic (不规则报刊版面：按重要级别区分大小与图文形态) */}
                  {DEFAULT_ANNOUNCEMENTS.length > 1 && (
                    <div className="paper-bento-grid">
                      {DEFAULT_ANNOUNCEMENTS.slice(1).map((a) => {
                        const photoCount = a.photos?.length ?? (a.photo ? 1 : 0);
                        const layout = a.layout ?? 'feature_tall';
                        const openArticle = () => {
                          sound.play('cursor');
                          setSelectedNewsId(a.id);
                          setNewsPhotoIdx(0);
                        };
                        const onKey = (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openArticle();
                          }
                        };

                        if (layout === 'photo_spotlight') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-photo-spotlight"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              {a.photo && (
                                <img
                                  className="paper-spotlight-img"
                                  src={a.photo}
                                  alt={a.title}
                                  draggable={false}
                                />
                              )}
                              <span className="paper-spotlight-tag">{a.tag}</span>
                              {photoCount > 1 && (
                                <span className="paper-spotlight-count">📷 {photoCount}图</span>
                              )}
                              <div className="paper-spotlight-overlay">
                                <time>{a.date}</time>
                                <h4>{a.title}</h4>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'wide_horizontal') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-wide-horizontal"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              {a.photo && (
                                <figure className="paper-wide-photo">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                                </figure>
                              )}
                              <div className="paper-wide-body">
                                <div className="paper-col-kicker">
                                  <span className="paper-kicker is-teal">{a.tag}</span>
                                  <time>{a.date}</time>
                                </div>
                                <h4 className="paper-col-headline is-lg">{a.title}</h4>
                                <p className="paper-col-excerpt">{a.body}</p>
                                <div className="paper-col-foot">
                                  <span>{a.reporter?.split('·')[1]?.trim() ?? '技术专报'}</span>
                                  <em>阅读全文 ›</em>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'text_wire') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-text-wire"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-col-kicker">
                                <span className="paper-kicker is-amber">⚡ {a.tag}</span>
                                <time>{a.date}</time>
                              </div>
                              <h4 className="paper-wire-headline">{a.title}</h4>
                              <p className="paper-wire-excerpt">{a.body}</p>
                              <div className="paper-col-foot">
                                <span>{photoCount > 0 ? `含 ${photoCount} 张现场图` : '快讯'}</span>
                                <em>详情 ›</em>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'photo_title') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-photo-title"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-col-kicker">
                                <span className="paper-kicker">{a.tag}</span>
                                <time>{a.date}</time>
                              </div>
                              {a.photo && (
                                <figure className="paper-col-photo is-compact">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                                </figure>
                              )}
                              <h4 className="paper-col-headline">{a.title}</h4>
                            </article>
                          );
                        }

                        if (layout === 'archive_right_thumb') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-archive-right"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-archive-copy">
                                <div className="paper-col-kicker">
                                  <span className="paper-kicker is-purple">{a.tag}</span>
                                  <time>{a.date}</time>
                                </div>
                                <h4 className="paper-col-headline">{a.title}</h4>
                                <p className="paper-col-excerpt is-two-line">{a.body}</p>
                              </div>
                              {a.photo && (
                                <figure className="paper-archive-thumb">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}</span>}
                                </figure>
                              )}
                            </article>
                          );
                        }

                        // Default: 'feature_tall' (large feature photo + headline + summary + footer)
                        return (
                          <article
                            key={a.id}
                            className="paper-bento-card is-feature-tall"
                            role="button"
                            tabIndex={0}
                            onClick={openArticle}
                            onKeyDown={onKey}
                          >
                            <div className="paper-col-kicker">
                              <span className="paper-kicker is-red">{a.tag}</span>
                              <time>{a.date}</time>
                            </div>
                            <h4 className="paper-col-headline is-lg">{a.title}</h4>
                            {a.photo && (
                              <figure className="paper-col-photo is-tall">
                                <img src={a.photo} alt={a.title} draggable={false} />
                                {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                              </figure>
                            )}
                            <p className="paper-col-excerpt">{a.body}</p>
                            <div className="paper-col-foot">
                              <span>{a.reporter?.split('·')[1]?.trim() ?? '前线快讯'}</span>
                              <em>全文 ›</em>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Newspaper Weather & Regional Brief Strip */}
                  <footer className="paper-brief-strip">
                    <strong>【东亚航线气象】</strong>
                    <span>上海 18°C 晴 · 深圳/香港 25°C 多云 · 东京/京都 16°C 樱风 · 札幌/哈尔滨 -3°C 小雪</span>
                  </footer>
                </div>
              )}
            </div>
          );
        })()}

        {/* ADVENTURE GUIDE INSIDE HANDHELD */}
        {mode === 'guide' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="inline-icon-row">
                <PixelItemImg src="/sprites/items/light-ball.png" size={16} />
                <span>3D 冒险操作指南</span>
              </div>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  if ((openedEntryMode === 'guide' || openedEntryMode === 'feedback') && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              >
                {openedEntryMode === 'guide' || openedEntryMode === 'feedback' ? '关闭' : '返回'}
              </button>
            </div>
            <div className="lcd-news-list scroll-y">
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">移动与视角</span>
                  <strong>自由探索阶梯原野</strong>
                </div>
                <p>WASD / 方向键 / 手柄左摇杆 360° 移动；鼠标拖动或右摇杆旋转视角，滚轮缩放，空格 / 手柄 A 键跳跃跨越崖壁。</p>
              </div>
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">战斗与战术</span>
                  <strong>4 招式配置 & 近战冲撞</strong>
                </div>
                <p>随从自动施放 4 个自由配置的像素招式，近战体格精灵会主动发起冲撞突袭！点击左侧精灵卡片可随时打开掌机调整招式与携带道具。</p>
              </div>
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">收服与徽章</span>
                  <strong>击晕收服 & 挑战道馆馆主</strong>
                </div>
                <p>击败精英、异色或区域守护者后可靠近或按投球键触发特写收服！击败野外道馆馆主收集关都 6 大徽章，解锁强力属性加成。</p>
              </div>
            </div>
          </div>
        )}

        {/* PLAYER FEEDBACK INSIDE HANDHELD */}
        {mode === 'feedback' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="inline-icon-row">
                <PixelItemImg src="/sprites/items/potion.png" size={16} />
                <span>问题反馈与建议箱</span>
              </div>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  if ((openedEntryMode === 'guide' || openedEntryMode === 'feedback') && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              >
                {openedEntryMode === 'guide' || openedEntryMode === 'feedback' ? '关闭' : '返回'}
              </button>
            </div>
            <div className="lcd-news-list scroll-y">
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">训练家留言</span>
                  <strong>欢迎提交宝可梦平衡、美术或新玩法建议</strong>
                </div>
                <p>你的每一条建议都会帮助我们把掌上像素宝可梦世界打磨得更生动有趣！</p>
              </div>
              <textarea
                className="lcd-fb-textarea"
                rows={4}
                placeholder="在这里输入你想新增的宝可梦、招式、地区或体验建议..."
                value={feedbackText}
                onChange={(e) => {
                  setFeedbackText(e.target.value);
                  setFeedbackSent(false);
                }}
              />
              <button
                type="button"
                className="lcd-inline-cta full"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  sound.play('confirm');
                  setFeedbackSent(true);
                  setFeedbackText('');
                }}
              >
                {feedbackSent ? '✓ 感谢反馈！已收录至训练家意见箱' : '提交建议'}
              </button>
            </div>
          </div>
        )}

    </>
  );
};
