import React, { useState } from 'react';
import {
  GYM_BADGE_CATALOG,
  HERO_ROSTER,
  LAB_UPGRADES,
  TRAINER_TAG_CATALOG,
  getActiveTrainerTagDef,
  getDailyResetCountdown,
  getHeroEvolutionStage,
  getLabUpgradeCost,
  getUnlockedTrainerTags,
  getWeeklyResetCountdown,
  type HeroId,
  type LabUpgradeId,
  type MetaProgressState,
  type TrainerTagId,
} from '../data/metaProgression';
import { PixelIcon, PixelItemImg } from './PixelSprite';
import { sound } from '../utils/sound';

export interface NewsPhotoItem {
  src: string;
  caption: string;
}

export type NewsCardLayout =
  | 'lead_banner'
  | 'feature_tall'
  | 'photo_spotlight'
  | 'wide_horizontal'
  | 'text_wire'
  | 'photo_title'
  | 'archive_right_thumb';

export interface ServerAnnouncement {
  id: string;
  tag: string;
  date: string;
  title: string;
  body: string;
  layout?: NewsCardLayout;
  photo?: string;
  photoCaption?: string;
  photos?: NewsPhotoItem[];
  reporter?: string;
  details?: string[];
}

/** Local seed announcements (immersive in-world Kanto dispatches with multi-photo GBA pixel-art press shots!) */
export const DEFAULT_ANNOUNCEMENTS: ServerAnnouncement[] = [
  {
    id: 'ann_east_asia_14_gyms',
    layout: 'lead_banner',
    tag: '环球巡礼',
    date: '关都历 11-26',
    title: '东亚 14 座地标道馆全线贯通！日本新增 5 城道馆、实景航班与城市买房定居开放',
    body: '世界巡礼第 1 赛季迎来重磅扩建！除北京、上海、杭州、广州、深圳、成都、哈尔滨、香港外，日本赛区全新开放京都、大阪、札幌、福冈、冲绳五大城市道馆，并同步启用真实卫星地形、浮动往返机票与城市置业定居体系！',
    photo: '/sprites/news/news-east-asia-tour.png',
    photoCaption: '东亚 14 城道馆巡礼航线全面开通，樱花古塔与海滨航班迎来大批训练家',
    photos: [
      {
        src: '/sprites/news/news-east-asia-tour.png',
        caption: '东亚 14 城道馆巡礼航线全面开通，樱花古塔与海滨航班迎来大批训练家',
      },
      {
        src: '/sprites/news/news-gym-arena.png',
        caption: '京都圆朱凤王古殿、大阪通天阁雷炎馆、札幌雪峰冰馆等日本新道馆整装待发',
      },
    ],
    reporter: '关都日报环球特派记者 · 芽衣',
    details: [
      '东亚赛区现共开放 14 座地标道馆：华夏 8 城（京/沪/杭/穗/深/蓉/哈/港）+ 日本 6 城（东京/京都/大阪/札幌/福冈/冲绳）。',
      '实景航空票价改版：普通出行需购买往返机票（起飞 ≥ 3,000 币，随真实航程距离浮动），仅「买房定居」支持购买单程迁居机票！',
      '城市置业定居：各地房价依据城市等级差异定价（108,000–320,000 币），买房后以后飞抵该城永久免住酒店，只需支付往返机票并常享全队 +12% 攻击加成！',
      'GPS 定位已升级为「系统快速定位 → 手机 GPS/北斗搜星 → 室内网络定位」三级兜底方案，室内也能顺畅锚定家乡。',
    ],
  },
  {
    id: 'ann_chinese_species_palettes',
    layout: 'feature_tall',
    tag: '生态特刊',
    date: '关都历 11-26',
    title: '13 支华夏风宝可梦家族登场！青花瓷、朱砂红等 6 款地域限定配色野外可捕',
    body: '大木博士联合东亚生态观察站宣布：凤王、小火焰猴、暖暖猪、功夫鼬、顽皮熊猫、老翁龙、熊徒弟及帕底亚四凶兽等 13 支东方特色家族正式加入图鉴，华夏各大城市野外更会随机出没专属国风地域配色！',
    photo: '/sprites/news/news-chinese-palettes.png',
    photoCaption: '古园实拍：竹林宫灯间现身的青花瓷与翡翠青限定灵光宝可梦',
    photos: [
      {
        src: '/sprites/news/news-chinese-palettes.png',
        caption: '古园实拍：竹林宫灯间现身的青花瓷与翡翠青限定灵光宝可梦',
      },
      {
        src: '/sprites/news/news-lab-shiny.png',
        caption: '图鉴总数扩充至 95 支家族 / 175 种形态，捕获地域限定色将永久解锁对应外观',
      },
    ],
    reporter: '东亚生态特约记者 · 莎莉娜',
    details: [
      '全新实装 13 支东方/华夏风宝可梦家族（含 8 向像素行走图与官方叫声）：凤王、晃晃斑、小火焰猴、铜镜怪、暖暖猪、功夫鼬、顽皮熊猫、老翁龙、熊徒弟、古简蜗、古剑豹、古鼎鹿、古玉鱼。',
      '6 款华夏限定配色上线：青花瓷（沪/深）、朱砂红（北京）、翡翠青（杭州）、水墨丹青（成都）、敦煌丹霞（广/港）、冰裂釉（哈尔滨/札幌）！',
      '在对应城市野外探索时有概率遭遇带有专属光环的限定色野生精灵，击败击晕后投球收服即可直接继承该稀有外观并在 3D 世界中展示！',
    ],
  },
  {
    id: 'ann_real_dem_overland',
    layout: 'photo_spotlight',
    tag: '摄影特写',
    date: '关都历 11-25',
    title: '深港实景海岸线贯通！3D 徒步跨湾实拍',
    body: '联盟地理测绘局接入全球卫星影像与双层高程数据：沿海城市呈现真实海湾与浅滩，内陆山脉拔地而起，训练家甚至可以从深圳湾一路向南徒步跨过陆海边界直抵香港维港！',
    photo: '/sprites/news/news-szhk-coast.png',
    photoCaption: '晴空下的海湾步道与跨海长桥，训练家携水系伙伴沿真实海岸线徒步前行',
    photos: [
      {
        src: '/sprites/news/news-szhk-coast.png',
        caption: '晴空下的海湾步道与跨海长桥，训练家携水系伙伴沿真实海岸线徒步前行',
      },
      {
        src: '/sprites/news/news-rail-viaduct.png',
        caption: '实景高程地貌与 18 级无缝像素卫星地图现已全面联动',
      },
    ],
    reporter: '地理测绘特派员 · 阿驯',
    details: [
      '世界地图支持 Z1.3 至 Z18.5 街道级无限缩放，真实卫星图实时像素化呈现。',
      '3D 探险世界采用双层全球高程模型（宏观陆海轮廓 + 精细局部山体），自动还原各城市真实海岸、平原与山脉。',
      '深圳与香港之间按 20 单位/公里实景比例打通，徒步跨越边界时将自动触发无缝跨城广播并切换当地野生精灵池！',
    ],
  },
  {
    id: 'ann_mobile_and_combat_upgrade',
    layout: 'wide_horizontal',
    tag: '技术专报',
    date: '关都历 11-26',
    title: '手机端全屏掌机与操控大进化！升级奖励重构聚焦纯构筑',
    body: '局内升级与安全屋商店全面移除精灵抽取，专注升级、被动与道具；手机端升级双指地图缩放、防卡死摇杆、原生零卡顿全屏掌机及侧滑返回手势！',
    photo: '/sprites/news/news-handheld-mobile.png',
    photoCaption: '联盟技术工坊实拍：研发团队正在调校新一代全屏像素掌机与全球卫星航图终端',
    photos: [
      {
        src: '/sprites/news/news-handheld-mobile.png',
        caption: '联盟技术工坊实拍：研发团队正在调校新一代全屏像素掌机与全球卫星航图终端',
      },
    ],
    reporter: '联盟工程快讯 · 健太',
    details: [
      '局内升级与安全屋商店不再提供直接获得宝可梦的选项，所有奖励聚焦于「升级精灵」「获取/强化被动」与「补给道具」，精灵获取回归野外投球收服与球盒养成！',
      '修复手机端虚拟摇杆在弹窗切换时偶发方向卡死的问题，地图拖拽与双指缩放升级为原生零延迟 60FPS 响应。',
      '全屏掌机重构为原生视口布局并自动暂停底层 3D 渲染，修复异常滚动与卡顿；手机实体/侧滑返回键现可逐层返回或关闭掌机与地图界面！',
    ],
  },
  {
    id: 'ann_gym_reopen',
    layout: 'text_wire',
    tag: '联盟电讯',
    date: '关都历 11-25',
    title: '尼比与华蓝等关都 6 大道馆全面重开',
    body: '此前因风暴海岸强雷雨及山谷大雾暂停接待的关都道馆已恢复开放，小刚、小霞、马志士等馆主整装待发，击败即可点亮徽章永久增益！',
    photo: '/sprites/news/news-gym-reopen.png',
    photoCaption: '雨后放晴的海滨道馆广场，彩旗飘扬、训练家陆续抵达现场',
    photos: [
      {
        src: '/sprites/news/news-gym-reopen.png',
        caption: '雨后放晴的海滨道馆广场，彩旗飘扬、训练家陆续抵达现场',
      },
      {
        src: '/sprites/news/news-gym-arena.png',
        caption: '道馆室内竞技场与关都 6 大徽章展示台已就绪，首场友谊赛火热开打',
      },
    ],
    reporter: '关都日报前线记者 · 芽衣',
    details: [
      '尼比道馆（小刚）、华蓝道馆（小霞）、枯叶道馆（马志士）等 6 位馆主现已重返原野巡逻。',
      '击败对应道馆馆主即可点亮「灰色、蓝色、橙色、彩虹、深红、绿色」关都徽章，永久强化指定属性宝可梦。',
      '大木研究所已同步更新训练师身份认证：从「基础训练师」一路晋升至「关都冠军」，可自由切换生效光环。',
    ],
  },
  {
    id: 'ann_rail_repaired',
    layout: 'photo_title',
    tag: '交通简讯',
    date: '关都历 11-24',
    title: '通往天空冰川与红莲火山的山区铁路全线复通',
    body: '前几日因野生快龙与卡比兽在阶梯峡谷激战，导致前往岩石沙漠、天空冰川及红莲火山的铁路桥与海滨步道受损。经宝可梦救援队连夜抢修，五大生态区现已全线恢复通行！',
    photo: '/sprites/news/news-rail-repaired.png',
    photoCaption: '首班复通快车驶过新修峡谷石桥，远处可见天空冰川与红莲火山',
    photos: [
      {
        src: '/sprites/news/news-rail-repaired.png',
        caption: '首班复通快车驶过新修峡谷石桥，远处可见天空冰川与红莲火山',
      },
      {
        src: '/sprites/news/news-rail-viaduct.png',
        caption: '午后青碧峡谷高架桥，快龙与皮卡丘伴随复通快车一路巡航护航',
      },
    ],
    reporter: '交通频道随行记者 · 健太',
    details: [
      '青翠森林、岩石沙漠（仙人掌峡谷）、风暴海岸（热带椰林）、天空冰川（冰晶雪松）与红莲火山（熔岩黑曜石）全部开放。',
      '沿途发现大量稀有野生与飞行系宝可梦在山坡草地间栖息、翱翔，击晕稀有与异色精灵后请把握时机投球收服。',
      '旅途补给站已全面接入掌机系统，随时可查看操作指南或向联盟意见箱反馈路况。',
    ],
  },
  {
    id: 'ann_mega_lab',
    layout: 'archive_right_thumb',
    tag: '研究档案',
    date: '关都历 11-23',
    title: '大木研究所突破：「超进化共鸣」与稀有异色外观正式开放',
    body: '当训练家与伙伴亲密度达 Lv.5 时可在战斗齐射中觉醒超进化/超极巨化形态，研究所同步扩充至 16 项永久特训与全新像素主角头像！',
    photo: '/sprites/news/news-mega-lab.png',
    photoCaption: '研究所实拍：悬浮的虹色进化钥石正释放共鸣星辉波动',
    photos: [
      {
        src: '/sprites/news/news-mega-lab.png',
        caption: '研究所实拍：悬浮的虹色进化钥石正释放共鸣星辉波动',
      },
      {
        src: '/sprites/news/news-lab-shiny.png',
        caption: '实验台近景：大木博士正在记录异色宝可梦与虹色棱晶的能量波形',
      },
    ],
    reporter: '真新镇特约科技记者 · 莎莉娜',
    details: [
      '研究所新增「携带上限、气势披带复活、焦点会心、磐石护甲、收服大师、冒险补给包」等共 16 项特训。',
      '精灵详情页新增「亲密·外观」档案，解锁 Lv.2–Lv.10 全套亲密度被动奖励。',
      '友好商店全新上架「官方异色 ★」「岩浆裂纹」「苍蓝圣炎」「花见·樱之灵」「太阳法老」及六大华夏限定外观！',
    ],
  },
];

/* =========================================================================
   1. RESEARCH LAB OVERLAY (Universal Permanent Upgrades + Switchable Heroes!)
   ========================================================================= */
interface LabOverlayProps {
  meta: MetaProgressState;
  closing: boolean;
  onClose: () => void;
  onBuyLabUpgrade: (id: LabUpgradeId) => void;
  onUnlockOrSelectHero: (heroId: HeroId) => void;
  onUpgradeHeroSkill: (heroId: HeroId, skillId: string) => void;
  onSelectTrainerTag?: (tagId: TrainerTagId) => void;
}

export const LabOverlay: React.FC<LabOverlayProps> = ({
  meta,
  closing,
  onClose,
  onBuyLabUpgrade,
  onUnlockOrSelectHero,
  onUpgradeHeroSkill,
  onSelectTrainerTag,
}) => {
  const [tab, setTab] = useState<'universal' | 'heroes' | 'badges'>('universal');
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>(meta.activeHero);
  const unlockedTags = getUnlockedTrainerTags(meta);
  const activeTagDef = getActiveTrainerTagDef(meta);
  const earnedBadges = meta.unlockedBadges ?? [];

  const totalLabLv = LAB_UPGRADES.reduce((acc, u) => acc + (meta.labLevels[u.id] ?? 0), 0);
  const maxLabLv = LAB_UPGRADES.reduce((acc, u) => acc + u.maxLevel, 0);
  const inspectedHero = HERO_ROSTER.find((h) => h.id === selectedHeroId) ?? HERO_ROSTER[0];
  const heroUnlocked = meta.unlockedHeroes.includes(inspectedHero.id);
  const isActiveHero = meta.activeHero === inspectedHero.id;
  const heroEvo = getHeroEvolutionStage(inspectedHero.id, meta.heroSkillLevels);

  return (
    <div
      className={`meta-fullscreen-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="meta-panel is-lab">
        <header className="meta-head">
          <button type="button" className="pkb-esc-btn" onClick={onClose}>
            <PixelIcon name="arrow_left" size={13} />
            <span>返回</span>
          </button>
          <div className="meta-ribbon is-orange">
            <PixelItemImg src="/sprites/items/exp-share.png" size={18} />
            <h2>研究所 · 永久强化与主角觉醒</h2>
          </div>
          <div className="meta-head-right">
            <div className="stardust-pill" title="星星沙子 · 通过 3D 讨伐、首领与委托获取">
              <PixelItemImg src="/sprites/items/bright-powder.png" size={18} />
              <strong>{meta.stardust}</strong>
              <small>星沙</small>
            </div>
          </div>
        </header>

        <div className="meta-split-shell">
          <nav className="meta-side-rail" aria-label="研究所分类">
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'universal' ? 'active' : ''}`}
              title={`通用强化 (${totalLabLv}/${maxLabLv})`}
              aria-label={`通用强化 ${totalLabLv}/${maxLabLv}`}
              onClick={() => {
                sound.play('cursor');
                setTab('universal');
              }}
            >
              <PixelItemImg src="/sprites/items/life-orb.png" size={32} />
              <em>{totalLabLv}/{maxLabLv}</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'heroes' ? 'active' : ''}`}
              title={`主角与专属技能 (${meta.unlockedHeroes.length}/${HERO_ROSTER.length})`}
              aria-label={`主角与专属技能 ${meta.unlockedHeroes.length}/${HERO_ROSTER.length}`}
              onClick={() => {
                sound.play('cursor');
                setTab('heroes');
              }}
            >
              <PixelItemImg src={inspectedHero.avatarSprite} size={32} />
              <em>{meta.unlockedHeroes.length}/{HERO_ROSTER.length}</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'badges' ? 'active' : ''}`}
              title={`道馆徽章与标签 (${earnedBadges.length}/${GYM_BADGE_CATALOG.length})`}
              aria-label={`道馆徽章与标签 ${earnedBadges.length}/${GYM_BADGE_CATALOG.length}`}
              onClick={() => {
                sound.play('cursor');
                setTab('badges');
              }}
            >
              <PixelItemImg src="/sprites/items/kings-rock.png" size={32} />
              <em>{earnedBadges.length}/{GYM_BADGE_CATALOG.length}</em>
            </button>
          </nav>

          {tab === 'universal' ? (
          <div className="meta-body scroll-y">
            <div className="meta-section-label">
              <strong>全局永久属性强化</strong>
              <span>对所有出战主角与随从永久生效</span>
            </div>
            <div className="lab-upgrade-grid">
              {LAB_UPGRADES.map((u) => {
                const lv = meta.labLevels[u.id] ?? 0;
                const maxed = lv >= u.maxLevel;
                const cost = getLabUpgradeCost(u, lv);
                const canBuy = !maxed && meta.stardust >= cost;
                return (
                  <div key={u.id} className={`lab-card ${maxed ? 'is-maxed' : ''}`}>
                    <div className="lab-card-stripe" style={{ backgroundColor: u.accent }}>
                      <span className="lab-lv-tag">
                        Lv.{lv}/{u.maxLevel}
                      </span>
                    </div>
                    <div className="lab-card-ico">
                      <PixelItemImg src={u.icon} size={32} />
                    </div>
                    <strong>{u.name}</strong>
                    <small>{u.perLevelLabel}</small>
                    <p>{u.desc}</p>
                    <div className="lab-pip-bar">
                      {Array.from({ length: u.maxLevel }).map((_, i) => (
                        <i
                          key={i}
                          className={i < lv ? 'is-filled' : ''}
                          style={i < lv ? { backgroundColor: u.accent } : undefined}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="lab-buy-btn"
                      disabled={!canBuy}
                      onClick={() => onBuyLabUpgrade(u.id)}
                    >
                      {maxed ? (
                        <span>已满级</span>
                      ) : (
                        <>
                          <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                          <span>{cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'heroes' ? (
          <div className="meta-body hero-lab-layout">
            {/* Left: 4 Switchable Protagonists */}
            <div className="hero-roster-col">
              {HERO_ROSTER.map((h) => {
                const unlocked = meta.unlockedHeroes.includes(h.id);
                const active = meta.activeHero === h.id;
                const evo = getHeroEvolutionStage(h.id, meta.heroSkillLevels);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`hero-pick-card ${selectedHeroId === h.id ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
                    style={{ '--hero-accent': h.accentColor } as React.CSSProperties}
                    onClick={() => {
                      sound.play('cursor');
                      setSelectedHeroId(h.id);
                    }}
                  >
                    <div className="hero-pick-avatar">
                      <PixelItemImg src={h.avatarSprite} size={36} />
                    </div>
                    <div className="hero-pick-info">
                      <div className="inline-icon-row">
                        <strong>{h.name}</strong>
                        {active && <em className="hero-tag is-on">出战中</em>}
                        {!unlocked && <em className="hero-tag is-lock">待解锁</em>}
                      </div>
                      <small>{evo.title}</small>
                      <div className="hero-mini-bar">
                        <div style={{ width: `${(evo.totalSkillLv / evo.maxSkillLv) * 100}%`, backgroundColor: h.accentColor }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Selected Protagonist Details, Awakening Evolution & Exclusive Skills */}
            <div className="hero-detail-col">
              <div className="hero-banner-card" style={{ borderLeftColor: inspectedHero.accentColor }}>
                <div className="hero-banner-left">
                  <div className="hero-lg-frame" style={{ borderColor: inspectedHero.accentColor }}>
                    <PixelItemImg src={inspectedHero.avatarSprite} size={52} />
                  </div>
                  <div>
                    <div className="inline-icon-row">
                      <h3>{inspectedHero.name}</h3>
                      <span className="hero-evo-pill" style={{ backgroundColor: inspectedHero.accentColor }}>
                        {heroEvo.tier === 2 ? '★ 觉醒形态' : heroEvo.tier === 1 ? '◆ 进阶形态' : '● 初始形态'} · {heroEvo.title}
                      </span>
                    </div>
                    <p>{inspectedHero.bio}</p>
                    <div className="hero-base-chips">
                      <span>HP {inspectedHero.baseHpBonus >= 0 ? `+${inspectedHero.baseHpBonus}` : inspectedHero.baseHpBonus}</span>
                      <span>伤害 +{Math.round(inspectedHero.baseAtkBonus * 100)}%</span>
                      <span>移速 {inspectedHero.baseSpeedBonus >= 0 ? `+${Math.round(inspectedHero.baseSpeedBonus * 100)}%` : `${Math.round(inspectedHero.baseSpeedBonus * 100)}%`}</span>
                      <span>觉醒进度 {heroEvo.totalSkillLv}/{heroEvo.maxSkillLv}</span>
                    </div>
                  </div>
                </div>
                <div className="hero-banner-cta">
                  {heroUnlocked ? (
                    <button
                      type="button"
                      className={`hero-deploy-btn ${isActiveHero ? 'is-on' : ''}`}
                      disabled={isActiveHero}
                      onClick={() => onUnlockOrSelectHero(inspectedHero.id)}
                    >
                      {isActiveHero ? '当前出战主角' : '切换为出战主角'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hero-deploy-btn is-unlock"
                      disabled={meta.stardust < inspectedHero.unlockCost}
                      onClick={() => onUnlockOrSelectHero(inspectedHero.id)}
                    >
                      <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                      <span>{inspectedHero.unlockCost} 解锁主角</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="hero-skills-grid">
                {inspectedHero.skills.map((sk) => {
                  const skLv = meta.heroSkillLevels[sk.id] ?? 0;
                  const evolved = skLv >= sk.maxLevel;
                  const cost = sk.baseCost + skLv * sk.costStep;
                  const canUpgrade = heroUnlocked && !evolved && meta.stardust >= cost;
                  return (
                    <div key={sk.id} className={`hero-skill-card ${evolved ? 'is-evolved' : ''}`}>
                      <div className="hero-sk-top">
                        <div className="hero-sk-ico">
                          <PixelItemImg src={sk.icon} size={32} />
                        </div>
                        <div className="hero-sk-title">
                          <div className="inline-icon-row">
                            <strong>{evolved ? sk.evolvedName : sk.name}</strong>
                            <em className="hero-sk-lv">Lv.{skLv}/{sk.maxLevel}</em>
                          </div>
                          <small>{evolved ? sk.evolvedDesc : sk.desc}</small>
                        </div>
                      </div>
                      <div className="hero-evo-preview">
                        <PixelIcon name="sparkle" size={12} />
                        <span>
                          Lv.{sk.maxLevel} 觉醒进化 → <b>{sk.evolvedName}</b>：{sk.evolvedDesc}
                        </span>
                      </div>
                      <div className="lab-pip-bar">
                        {Array.from({ length: sk.maxLevel }).map((_, i) => (
                          <i
                            key={i}
                            className={i < skLv ? 'is-filled' : ''}
                            style={i < skLv ? { backgroundColor: inspectedHero.accentColor } : undefined}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="lab-buy-btn"
                        disabled={!canUpgrade}
                        onClick={() => onUpgradeHeroSkill(inspectedHero.id, sk.id)}
                      >
                        {!heroUnlocked ? (
                          <span>请先解锁主角</span>
                        ) : evolved ? (
                          <span>★ 已觉醒满级</span>
                        ) : (
                          <>
                            <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                            <span>{cost} 强化专属技</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="meta-body scroll-y">
            <div className="meta-section-label">
              <strong>训练师身份标签（当前：{activeTagDef.name}）</strong>
              <span>切换已解锁标签，为指定属性与地区宝可梦提供战力光环</span>
            </div>
            <div className="lab-tags-grid">
              {TRAINER_TAG_CATALOG.map((tag) => {
                const isUnlocked = unlockedTags.includes(tag.id);
                const isActive = activeTagDef.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={!isUnlocked}
                    className={`lab-tag-card ${isActive ? 'is-active' : ''} ${!isUnlocked ? 'is-locked' : ''}`}
                    style={{ '--tag-col': tag.color } as React.CSSProperties}
                    onClick={() => {
                      if (!isUnlocked) return;
                      sound.play('confirm');
                      onSelectTrainerTag?.(tag.id);
                    }}
                  >
                    <div className="lab-tag-head">
                      <PixelItemImg src={tag.icon} size={22} />
                      <div className="lab-tag-title">
                        <strong>{tag.name}</strong>
                        <em style={{ backgroundColor: tag.color }}>{tag.tierLabel}</em>
                      </div>
                      {isActive && <span className="lab-tag-equipped">生效中</span>}
                    </div>
                    <p className="lab-tag-perk">{tag.perkText}</p>
                    <small className="lab-tag-unlock">{isUnlocked ? '✓ 已解锁 · 点击切换' : `解锁条件：${tag.unlockText}`}</small>
                  </button>
                );
              })}
            </div>

            <div className="meta-section-label" style={{ marginTop: 14 }}>
              <strong>关都道馆徽章盒（已收集 {earnedBadges.length}/{GYM_BADGE_CATALOG.length}）</strong>
              <span>击败野外道馆馆主或通关对应地区自动获得，所有已收集徽章永久叠加生效！</span>
            </div>
            <div className="lab-badges-grid">
              {GYM_BADGE_CATALOG.map((b) => {
                const owned = earnedBadges.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className={`lab-badge-card ${owned ? 'is-owned' : 'is-locked'}`}
                    style={{ '--badge-col': b.color } as React.CSSProperties}
                  >
                    <div className="lab-badge-ico">
                      <PixelItemImg src={b.icon} size={30} />
                    </div>
                    <div className="lab-badge-info">
                      <div className="lab-badge-top">
                        <strong>{b.name}</strong>
                        <small>{b.gymName}</small>
                      </div>
                      <p>{b.perkText}</p>
                      <span className="lab-badge-cond">{owned ? '★ 已点亮生效' : b.unlockHint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. DAILY & WEEKLY BOUNTIES OVERLAY (任务委托)
   ========================================================================= */
interface BountiesOverlayProps {
  meta: MetaProgressState;
  closing: boolean;
  onClose: () => void;
  onClaimBounty: (kind: 'daily' | 'weekly', slotIdx: number) => void;
  onRerollBounty: (kind: 'daily' | 'weekly', slotIdx: number) => void;
  onClaimBonusChest: (kind: 'daily' | 'weekly') => void;
}

export const BountiesOverlay: React.FC<BountiesOverlayProps> = ({
  meta,
  closing,
  onClose,
  onClaimBounty,
  onRerollBounty,
  onClaimBonusChest,
}) => {
  const dailyDone = meta.dailyBounties.filter((b) => b.claimed).length;
  const weeklyDone = meta.weeklyBounties.filter((b) => b.claimed).length;

  const renderColumn = (kind: 'daily' | 'weekly') => {
    const isDaily = kind === 'daily';
    const list = isDaily ? meta.dailyBounties : meta.weeklyBounties;
    const doneCnt = isDaily ? dailyDone : weeklyDone;
    const bonusClaimed = isDaily ? meta.dailyBonusClaimed : meta.weeklyBonusClaimed;
    const canClaimBonus = !bonusClaimed && doneCnt >= 3;

    return (
      <section className={`bounty-col ${isDaily ? 'is-daily' : 'is-weekly'}`}>
        <div className="bounty-col-head">
          <div>
            <small>{isDaily ? '每日委托 · UTC 00:00 刷新' : '本周委托 · 每周一刷新'}</small>
            <h3>{isDaily ? '今日委托' : '本周委托'}</h3>
            <span className="bounty-countdown">
              距下次刷新：{isDaily ? getDailyResetCountdown() : getWeeklyResetCountdown()}
            </span>
          </div>
          {isDaily && <span className="bounty-streak-pill">连续 {meta.dailyStreak} 天</span>}
        </div>

        {/* 3-Step Milestone Track */}
        <div className="bounty-steps">
          {[1, 2, 3].map((step) => (
            <span key={step} className={doneCnt >= step ? 'is-done' : ''}>
              {step}
            </span>
          ))}
        </div>

        <div className="bounty-list">
          {list.map((b, idx) => {
            const pct = Math.min(100, Math.round((b.progress / b.target) * 100));
            const ready = !b.claimed && b.progress >= b.target;
            return (
              <div key={b.id} className={`bounty-card ${ready ? 'is-ready' : ''} ${b.claimed ? 'is-claimed' : ''}`}>
                <div className="bounty-ico">
                  <PixelItemImg src={b.icon} size={28} />
                </div>
                <div className="bounty-info">
                  <div className="inline-icon-row">
                    <span className={`bounty-tier tier-${b.tier}`}>{b.tierLabel}</span>
                    <strong>{b.title}</strong>
                  </div>
                  <small>{b.desc}</small>
                  <div className="bounty-prog-row">
                    <div className="bounty-prog-track">
                      <div className="bounty-prog-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <em>
                      {b.progress.toLocaleString()} / {b.target.toLocaleString()}
                    </em>
                  </div>
                </div>
                <div className="bounty-actions">
                  {b.claimed ? (
                    <span className="bounty-done-tag">✓ 已领</span>
                  ) : ready ? (
                    <button
                      type="button"
                      className="bounty-claim-btn"
                      onClick={() => onClaimBounty(kind, idx)}
                    >
                      领取 +{b.rewardStardust}
                    </button>
                  ) : (
                    <>
                      <span className="bounty-reward-chip">
                        <PixelItemImg src="/sprites/items/bright-powder.png" size={12} />+{b.rewardStardust}
                      </span>
                      <button
                        type="button"
                        className="bounty-reroll-btn"
                        onClick={() => onRerollBounty(kind, idx)}
                        title="免费更换一条委托"
                      >
                        更换
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand Completion Chest */}
        <div className={`bounty-chest-box ${canClaimBonus ? 'is-ready' : ''}`}>
          <div>
            <strong>{isDaily ? '每日全勤大奖' : '每周全勤大奖'}</strong>
            <small>
              领取全部 3 条委托解锁 ({doneCnt}/3) · 奖励 {isDaily ? '+80 星沙 +120 金币' : '+450 星沙 +500 金币'}
            </small>
          </div>
          <button
            type="button"
            className="bounty-chest-btn"
            disabled={!canClaimBonus}
            onClick={() => onClaimBonusChest(kind)}
          >
            {bonusClaimed ? '✓ 已领取' : canClaimBonus ? '立即开启宝箱！' : '未达成'}
          </button>
        </div>
      </section>
    );
  };

  return (
    <div
      className={`meta-fullscreen-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="meta-panel is-bounties">
        <header className="meta-head">
          <button type="button" className="pkb-esc-btn" onClick={onClose}>
            <PixelIcon name="arrow_left" size={13} />
            <span>返回</span>
          </button>
          <div className="meta-ribbon is-purple">
            <PixelItemImg src="/sprites/items/vs-seeker.png" size={18} />
            <h2>任务委托 · 赚取星星沙子</h2>
          </div>
          <div className="stardust-pill">
            <PixelItemImg src="/sprites/items/bright-powder.png" size={18} />
            <strong>{meta.stardust}</strong>
            <small>星沙</small>
          </div>
        </header>
        <div className="bounties-grid-2 scroll-y">
          {renderColumn('daily')}
          {renderColumn('weekly')}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   3. NEWS / GUIDE / FEEDBACK MODALS
   ========================================================================= */
interface InfoModalProps {
  kind: 'news' | 'guide' | 'feedback';
  closing: boolean;
  onClose: () => void;
}

export const HubInfoModal: React.FC<InfoModalProps> = ({ kind, closing, onClose }) => {
  const [fbText, setFbText] = useState('');
  const [fbSent, setFbSent] = useState(false);

  return (
    <div
      className={`surv-modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="surv-upgrade-box pkb-info-modal">
        <div className="surv-upgrade-head shop-head-row">
          <span>
            {kind === 'news'
              ? '官方公告与版本更新（支持服务器接入）'
              : kind === 'guide'
                ? 'POKé POCKET 3D 冒险操作指南'
                : '问题反馈与建议提交'}
          </span>
          <button type="button" className="lcd-mini-close" onClick={onClose}>
            关闭
          </button>
        </div>

        {kind === 'news' && (
          <div className="info-modal-body scroll-y">
            {DEFAULT_ANNOUNCEMENTS.map((a) => (
              <article key={a.id} className="news-card">
                <div className="news-card-head">
                  <span className="news-tag">{a.tag}</span>
                  <strong>{a.title}</strong>
                  <em>{a.date}</em>
                </div>
                <p>{a.body}</p>
              </article>
            ))}
          </div>
        )}

        {kind === 'guide' && (
          <div className="info-modal-body scroll-y">
            <div className="guide-grid">
              <div className="guide-box">
                <strong>3D 移动与视角控制</strong>
                <p>WASD / 方向键移动，空格跳跃登上 2m 阶梯崖壁。点击 3D 画面锁定自由鼠标视角（ESC/Alt 释放），也可直接按住左/右键拖拽转向，滚轮缩放，R 复位。</p>
              </div>
              <div className="guide-box">
                <strong>随从战斗与战术切换</strong>
                <p>所有非休眠的随从会自主游走并释放双招式！按 Q 打开战术终端切换招式/阵型，按 E 掏出掌机照顾宝可梦，升级时按 1/2/3 极速选卡。</p>
              </div>
              <div className="guide-box">
                <strong>研究所、主角觉醒与委托</strong>
                <p>击败首领和完成每日/每周委托可赚取「星星沙子」，在研究所强化全局属性、解锁切换赤红/小霞/小刚/小茂并觉醒满级专属技能！</p>
              </div>
              <div className="guide-box">
                <strong>3D 实体掌机彩蛋</strong>
                <p>按住掌机非按钮外壳区域可自由 3D 倾斜把玩，双击外壳区域一键放平回正，右侧挂件支持全屏大视野模式！</p>
              </div>
            </div>
          </div>
        )}

        {kind === 'feedback' && (
          <div className="info-modal-body">
            {fbSent ? (
              <div className="fb-done-box">
                <PixelIcon name="heart" size={24} />
                <strong>感谢你的宝贵反馈！</strong>
                <p>反馈记录已保存至本地日志，后续接入后端服务器后将自动同步给开发团队。</p>
                <button type="button" className="lcd-inline-cta" onClick={onClose}>
                  返回大厅
                </button>
              </div>
            ) : (
              <div className="pkb-prof-form">
                <label>
                  <span>描述你遇到的问题或想新增的宝可梦/玩法建议</span>
                  <textarea
                    rows={4}
                    value={fbText}
                    onChange={(e) => setFbText(e.target.value)}
                    placeholder="例如：希望增加某个地图、优化某个技能特效、或报告画面异常..."
                  />
                </label>
                <button
                  type="button"
                  className="lcd-inline-cta full"
                  disabled={!fbText.trim()}
                  onClick={() => {
                    sound.play('confirm');
                    try {
                      const prev = JSON.parse(localStorage.getItem('pokepocket_feedback') || '[]');
                      prev.push({ at: new Date().toISOString(), text: fbText.trim() });
                      localStorage.setItem('pokepocket_feedback', JSON.stringify(prev));
                    } catch {
                      // ignore
                    }
                    setFbSent(true);
                  }}
                >
                  提交反馈
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
