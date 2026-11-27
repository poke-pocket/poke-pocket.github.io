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
  editionId: string;
  version: string;
  tag: string;
  date: string;
  title: string;
  body: string;
  layout?: NewsCardLayout;
  fullWidth?: boolean;
  photo?: string;
  photoCaption?: string;
  photos?: NewsPhotoItem[];
  reporter?: string;
  details?: string[];
}

export interface NewsEdition {
  id: string;
  version: string;
  issueNo: number;
  date: string;
  shortDate: string;
  title: string;
  subtitle: string;
  coverPhoto: string;
  weatherBrief: string;
  isLatest?: boolean;
  articles: ServerAnnouncement[];
}

/**
 * Global Pokémon Center Daily — Versioned Newspaper Editions (newest first).
 * Each edition groups the real shipped milestones of a release into a complete
 * front-page broadsheet issue.
 */
export const NEWS_EDITIONS: NewsEdition[] = [
  {
    id: 'ed_v1_9',
    version: 'v1.9',
    issueNo: 151,
    date: '11月27日',
    shortDate: '2026-11-27',
    title: '新一代投球速切装置发布，全球训练师等级与徽章展示体系革新',
    subtitle: '长按速切 9 种精灵球 · 全球等级阶梯 · 研究所深研至 Lv.10',
    coverPhoto: '/sprites/news/news-handheld-mobile.png',
    weatherBrief: '上海 12°C 晴 · 东京 14°C 晴 · 伦敦 9°C 细雨 · 纽约 7°C 多云 · 悉尼 23°C 晴',
    isLatest: true,
    articles: [
      {
        id: 'ann_v1_9_ball_switcher',
        editionId: 'ed_v1_9',
        version: 'v1.9',
        layout: 'lead_banner',
        tag: '装备革新',
        date: '11-27',
        title: '全球宝可梦中心发布新一代投球速切装置：长按瞬切 9 种球类，分级捕获率全面实装',
        body: '全球宝可梦中心装备研发署今日向全境训练家推送新款轮盘投球组件：轻点即可直接投掷当前选定精灵球，长按即可在左侧展开全图标球盒栏，秒切超级球、高级球、先机球、捕网球、黑暗球、计时球乃至必中大师球！',
        photo: '/sprites/news/news-handheld-mobile.png',
        photoCaption: '新款左置精灵球速切组件实拍：长按即弹出 9 种持有精灵球图标栏',
        photos: [
          {
            src: '/sprites/news/news-handheld-mobile.png',
            caption: '新款左置精灵球速切组件实拍：长按即弹出 9 种持有精灵球图标栏',
          },
          {
            src: '/sprites/news/news-gym-arena.png',
            caption: '不同品级与情境专用球现已分别生效：夜间黑暗球、水/虫捕网球、开局先机球与大师球必中机制全线验证通过',
          },
        ],
        reporter: '宝可梦中心环球记者 · 芽衣',
        details: [
          '标准精灵球保持无限补给；超级球（1.6×）、高级球（2.3×）、大师球（100% 必中）及各类情景球均在野外收服判定中真实生效。',
          '捕网球对水/草系加成显著，先机球在遭遇初期表现极佳，黑暗球于黄昏及夜晚自动触发高额倍率，计时球则随战斗回合递增收服率。',
          '训练家菜单同步接入《宝可梦中心日报》头条入口与研究所直达快捷入口，各子页面统一支持层级返回导航。',
        ],
      },
      {
        id: 'ann_v1_9_global_ranks',
        editionId: 'ed_v1_9',
        version: 'v1.9',
        layout: 'feature_tall',
        tag: '全球联讯',
        date: '11-27',
        title: '全球训练师等级体系去地域化！17 枚跨区徽章与 6 格自选展示柜正式开放',
        body: '全球宝可梦中心联盟宣布启用统一的无地域训练师等级阶梯——从「见习训练师 Lv.1」一路晋升至「冠军训练师 Lv.6」，并扩充至 17 枚跨区域道馆与荣誉徽章，支持任选 6 枚钉选至顶部信息卡展示或设为追逐目标！',
        photo: '/sprites/news/news-gym-reopen.png',
        photoCaption: '全球宝可梦中心认证大厅启用全新 6 格自选展示与目标追踪徽章盒',
        photos: [
          {
            src: '/sprites/news/news-gym-reopen.png',
            caption: '全球宝可梦中心认证大厅启用全新 6 格自选展示与目标追踪徽章盒',
          },
          {
            src: '/sprites/news/news-gym-arena.png',
            caption: '跨城巡礼、道馆挑战与大师荣誉三大类别共计 17 枚徽章已全数入库',
          },
        ],
        reporter: '宝可梦中心前线记者 · 芽衣',
        details: [
          '全新标准训练师等级阶梯：见习训练师（Lv.1）→ 进阶训练师（Lv.2）→ 精英训练师（Lv.3）→ 王牌训练师（Lv.4）→ 大师训练师（Lv.5）→ 冠军训练师（Lv.6）。',
          '玩家可在研究所「徽章与等级」页自由钉选最多 6 枚已获徽章或未获目标徽章，主界面左上角徽章盒实时同步点亮与追踪。',
          '系统设置键位页新增完整 3D 冒险与战斗全快捷键一览表，并修复 3D 场景热键偶发冲突。',
        ],
      },
      {
        id: 'ann_v1_9_lab_squad',
        editionId: 'ed_v1_9',
        version: 'v1.9',
        layout: 'photo_spotlight',
        tag: '特训专刊',
        date: '11-27',
        title: '研究所永久强化突破至 Lv.10！队伍一键休整与原位互动全面升级',
        body: '全球研究所将多项核心强化上限拓展至 Lv.10 并引入更具成长深度的阶梯星沙曲线；队伍管理界面新增一键治疗、一键喂食、自动编队与按级排序，精灵详情页亦支持原位快速喂果、治疗与洗澡！',
        photo: '/sprites/news/news-mega-lab.png',
        photoCaption: '研究所深度特训台升级完工，训练上限最高拓展至 Lv.10',
        photos: [
          {
            src: '/sprites/news/news-mega-lab.png',
            caption: '研究所深度特训台升级完工，训练上限最高拓展至 Lv.10',
          },
          {
            src: '/sprites/news/news-lab-shiny.png',
            caption: '队伍卡片新增 HP / 饱食度 / 经验条与异常角标，整备一目了然',
          },
        ],
        reporter: '全球科研特约记者 · 莎莉娜',
        details: [
          '研究所训练、韧性、敏捷、钻研、贸易、财运等核心项目上限拓展至 Lv.10，配套分段成长星沙消耗曲线，长线养成更有目标感。',
          '队伍管理页标签精简为紧凑图标序号与右上角人数角标，底部常驻一键治疗、一键喂食、自动编队与按级排序。',
          '精灵详情页新增原位快捷照料栏，无须切回球舱即可直接选择树果喂食、一键恢复体力与清洁互动。',
        ],
      },
    ],
  },
  {
    id: 'ed_v1_8',
    version: 'v1.8',
    issueNo: 150,
    date: '11月26日',
    shortDate: '2026-11-26',
    title: '东亚 14 城跨海航路全线复航！华夏古道观测到地域限定变色个体',
    subtitle: '东亚 14 城道馆复航 · 华夏地域限定色 · 西尔佛掌机固件检修',
    coverPhoto: '/sprites/news/news-east-asia-tour.png',
    weatherBrief: '上海 18°C 晴 · 深圳/香港 25°C 多云 · 东京/京都 16°C 樱风 · 札幌/哈尔滨 -3°C 小雪',
    articles: [
      {
        id: 'ann_east_asia_14_gyms',
        editionId: 'ed_v1_8',
        version: 'v1.8',
        layout: 'lead_banner',
        tag: '航线复航',
        date: '11-26',
        title: '东亚跨海航路全线复航！京都、大阪、札幌、福冈、冲绳五地道馆恢复接待',
        body: '此前受太平洋秋季异常气流与跨海信标干扰，飞往京都、大阪、札幌、福冈及冲绳的定期航班一度停飞，各地道馆亦暂缓跨区接待。经航空管理局与全球宝可梦中心联合检修信标，今起东亚 14 城航线全面恢复通航，各地不动产登记处亦同步恢复训练家跨城置业落户服务！',
        photo: '/sprites/news/news-east-asia-tour.png',
        photoCaption: '空域信标检修完毕后首班复航客机掠过樱花古塔与海滨道馆广场',
        photos: [
          {
            src: '/sprites/news/news-east-asia-tour.png',
            caption: '空域信标检修完毕后首班复航客机掠过樱花古塔与海滨道馆广场',
          },
          {
            src: '/sprites/news/news-gym-arena.png',
            caption: '京都圆朱凤王古殿、大阪通天阁雷炎馆、札幌雪峰冰馆等道馆现已恢复挑战预约',
          },
        ],
        reporter: '宝可梦中心环球记者 · 芽衣',
        details: [
          '随着太平洋空域恢复平静，北京、上海、杭州、广州、深圳、成都、哈尔滨、香港与东京、京都、大阪、札幌、福冈、冲绳 14 座地标道馆均已恢复全天候接待。',
          '民航规程重申：常规巡礼往返均按实景航程核定往返机票（起飞 3,000 币起），仅在当地办理置业迁居的训练家可申购单程迁居客票。',
          '各地城建署同步公布最新置业地价（依城市区位 108,000–320,000 币不等）；在当地拥有私宅的训练家日后乘机往返无须另付旅馆宿费，并可享受私宅全队状态休整。',
          '卫星定位模块已完成室内基站校频，无卫星环境下将自动借由基站网络锚定家乡。',
        ],
      },
      {
        id: 'ann_chinese_species_palettes',
        editionId: 'ed_v1_8',
        version: 'v1.8',
        layout: 'feature_tall',
        tag: '生态特刊',
        date: '11-26',
        title: '季风转暖！华夏古道重现凤王与熊猫踪迹，多地观测到青花瓷、朱砂红等地域变色个体',
        body: '伴随秋末山地雾气散去，先前隐居深山竹林与古刹遗迹的凤王、顽皮熊猫、功夫鼬、小火焰猴、老翁龙及古老封印地宝可梦近日频繁现身郊野。观测站同时证实，京沪杭蓉及北国雪原的野生族群中本就栖息着青花瓷、朱砂红等地域变色个体！',
        photo: '/sprites/news/news-chinese-palettes.png',
        photoCaption: '江南古园实拍：竹林宫灯间现身的青花瓷与翡翠青地域变色个体',
        photos: [
          {
            src: '/sprites/news/news-chinese-palettes.png',
            caption: '江南古园实拍：竹林宫灯间现身的青花瓷与翡翠青地域变色个体',
          },
          {
            src: '/sprites/news/news-lab-shiny.png',
            caption: '经宝可梦中心校准图鉴波频后，上述 13 支族群与 16 种战斗招式档案现已完整收录',
          },
        ],
        reporter: '全球生态特约记者 · 莎莉娜',
        details: [
          '受暖湿气流回升影响，凤王、晃晃斑、小火焰猴、铜镜怪、暖暖猪、功夫鼬、顽皮熊猫、老翁龙、熊徒弟及四处古老遗迹宝可梦陆续回归视野。',
          '受各地水土矿脉长期滋养，沪深「青花瓷」、北京「朱砂红」、杭州「翡翠青」、成都「水墨丹青」、广港「敦煌丹霞」及北境「冰裂釉」等地域色个体在野外均有目击报告。',
          '校准完成后，击晕投球收服即可完整保留其原本的地域体色。',
        ],
      },
      {
        id: 'ann_mobile_and_combat_upgrade',
        editionId: 'ed_v1_8',
        version: 'v1.8',
        layout: 'photo_spotlight',
        tag: '西尔佛通告',
        date: '11-26',
        title: '西尔佛掌机检修固件推送！宝可梦中心寄放箱重申「战后存取」规程',
        body: '西尔佛工程部已排查修复随身掌机宽屏掉帧、摇杆偶发回弹卡滞与返回键失灵等硬件故障；宝可梦中心亦重申：随身球盒满 60 只期间需先放生或战后办理寄放箱存取！',
        photo: '/sprites/news/news-handheld-mobile.png',
        photoCaption: '西尔佛技术工坊实拍：工程师连夜完成掌机全屏显示模块与卫星雷达驱动检修',
        photos: [
          {
            src: '/sprites/news/news-handheld-mobile.png',
            caption: '西尔佛技术工坊实拍：工程师连夜完成掌机全屏显示模块与卫星雷达驱动检修',
          },
        ],
        reporter: '西尔佛工程特讯 · 健太',
        details: [
          '为避免野外激战中传输信号波动导致精灵球遗失，随身球盒达到容量上限后请先放生多余伙伴或返回大厅后再前往寄放箱寄存。',
          '西尔佛掌机固件已修复切换全屏时的画面拖影、触控缩放卡顿及摇杆卡向问题，并优化音频播放表现。',
          '野外补给投放规程已重新规范，空投专注提供随从特训强化、被动秘笈与伤药补给，野生伙伴请统一通过正规投球收服。',
        ],
      },
    ],
  },
  {
    id: 'ed_v1_7',
    version: 'v1.7',
    issueNo: 149,
    date: '11月25日',
    shortDate: '2026-11-25',
    title: '1:10 真实地球高程与深港跨湾步道重开，全城双向公交站投入运营',
    subtitle: '真实山脉 DEM 高程 · 全城双向公交网络 · 统一地平线雾效与像素快门',
    coverPhoto: '/sprites/news/news-szhk-coast.png',
    weatherBrief: '深圳 25°C 多云 · 香港 24°C 微风 · 重庆 16°C 阴 · 成都 15°C 轻雾',
    articles: [
      {
        id: 'ann_real_dem_overland',
        editionId: 'ed_v1_7',
        version: 'v1.7',
        layout: 'lead_banner',
        tag: '摄影特写',
        date: '11-25',
        title: '深港跨湾步道修缮重开！1:10 真实地貌可徒步贯通森林、雪山与沙海',
        body: '此前因南海大潮冲刷封闭检修的深港沿岸海滨栈道今日重新开放！伴随高空测绘回传的真实地球高程数据拼接完毕，训练家不仅可沿海岸线跨城徒步，还能在原野中自然攀登真实山峰并穿越森林、雪山、沙漠与熔岩裂谷。',
        photo: '/sprites/news/news-szhk-coast.png',
        photoCaption: '修缮重开的跨湾木栈道与晴空海湾，训练家正携水系伙伴沿真实海岸徒步前行',
        photos: [
          {
            src: '/sprites/news/news-szhk-coast.png',
            caption: '修缮重开的跨湾木栈道与晴空海湾，训练家正携水系伙伴沿真实海岸徒步前行',
          },
          {
            src: '/sprites/news/news-rail-viaduct.png',
            caption: '地理局已完成全境高程拼图，Z9 地质滤镜精准保留全部真实山脊与山城坡度',
          },
        ],
        reporter: '地理测绘特派员 · 阿驯',
        details: [
          '海堤加固完工后，训练家可直接从深圳湾向南徒步跨越海岸边界进入香港维港生态圈。',
          '采用 1:10 真实地球大尺度比例，街道雷达毛刺已平滑过滤为舒缓城建坡度，而郊外真实山脉与山城起伏得到完整保留。',
          '顶部导航卡新增基于实时移速计算的动态预计到达时间（ETA），高空地图支持从全球视角一路平滑推近至街景。',
        ],
      },
      {
        id: 'ann_v1_7_bus_mist',
        editionId: 'ed_v1_7',
        version: 'v1.7',
        layout: 'wide_horizontal',
        tag: '城市基建',
        date: '11-25',
        title: '全城双向 3D 公交候车亭落成，地平线薄雾与 16-bit 精灵球快门同步上线',
        body: '全球宝可梦中心联合各城市交通署完成全城双向公交站点与实体候车亭建设，并统一了地形、水面、天空与体素建筑的远景地平线雾效；进图加载同步升级为经典红白精灵球开合像素快门！',
        photo: '/sprites/news/news-rail-repaired.png',
        photoCaption: '统一地平线雾效消除了远景贴图接缝，城市公交与远山层次浑然一体',
        photos: [
          {
            src: '/sprites/news/news-rail-repaired.png',
            caption: '统一地平线雾效消除了远景贴图接缝，城市公交与远山层次浑然一体',
          },
        ],
        reporter: '城建专线记者 · 健太',
        details: [
          '所有城市主干道均已布设双向 3D 实体公交候车亭与站牌，随时可沿途候车穿行各街区。',
          '统一远景地平线薄雾着色器，彻底消除了海面、山脊与高楼远端的边界切线。',
          '重构进图资源调度并引入 16-bit 拜耳抖动像素精灵球快门动画，大幅消除开场卡顿。',
        ],
      },
      {
        id: 'ann_v1_7_hud_dock',
        editionId: 'ed_v1_7',
        version: 'v1.7',
        layout: 'text_wire',
        tag: '中心快讯',
        date: '11-25',
        title: '顶部状态栏与随行球盒条焕新统一为 76px 精简高度',
        body: '随身终端顶部 HUD 完成全面对齐：左置城市定位与像素天气、中置正在播放的 BGM 曲目、右置无边框高清像素功能键，主角卡下方新增可折叠像素精灵球队伍条。',
        reporter: '终端评测记者 · 芽衣',
        details: [
          '顶部主角名片、状态信息条与功能按钮统一对齐至 76px 高度，视野更开阔清爽。',
          '主角名片下方挂载可折叠像素精灵球随行条，随时一眼查看全队状态并快速管理。',
        ],
      },
    ],
  },
  {
    id: 'ed_v1_6',
    version: 'v1.6',
    issueNo: 148,
    date: '11月24日',
    shortDate: '2026-11-24',
    title: '全球经典道馆全面重开，冰川与火山山区铁路全线复通',
    subtitle: '六大经典道馆恢复挑战 · 五大生态区山区快线贯通',
    coverPhoto: '/sprites/news/news-gym-reopen.png',
    weatherBrief: '海滨道馆 21°C 晴 · 冰川雪岭 -4°C 晴 · 火山裂谷 31°C 干热',
    articles: [
      {
        id: 'ann_gym_reopen',
        editionId: 'ed_v1_6',
        version: 'v1.6',
        layout: 'lead_banner',
        tag: '联盟电讯',
        date: '11-24',
        title: '尼比与华蓝等经典道馆全面重开，馆主巡逻挑战同步开启',
        body: '此前因风暴海岸强雷雨及山谷大雾暂停接待的多座经典道馆今日正式恢复开放！小刚、小霞、马志士等馆主已整装待发重返竞技场与原野巡逻，击败即可点亮徽章永久增益！',
        photo: '/sprites/news/news-gym-reopen.png',
        photoCaption: '雨后放晴的海滨道馆广场，彩旗飘扬、训练家陆续抵达现场',
        photos: [
          {
            src: '/sprites/news/news-gym-reopen.png',
            caption: '雨后放晴的海滨道馆广场，彩旗飘扬、训练家陆续抵达现场',
          },
          {
            src: '/sprites/news/news-gym-arena.png',
            caption: '道馆室内竞技场与徽章展示台已就绪，首场友谊赛火热开打',
          },
        ],
        reporter: '宝可梦中心前线记者 · 芽衣',
        details: [
          '尼比道馆（小刚）、华蓝道馆（小霞）、枯叶道馆（马志士）等经典馆主现已恢复全天候挑战。',
          '击败对应道馆馆主即可点亮灰色、蓝色、橙色、彩虹、深红、绿色等徽章，永久强化对应属性宝可梦。',
          '宝可梦中心同步上线道馆挑战成就与奖励体系，推进徽章收集即可晋升更高训练师等级。',
        ],
      },
      {
        id: 'ann_rail_repaired',
        editionId: 'ed_v1_6',
        version: 'v1.6',
        layout: 'wide_horizontal',
        fullWidth: true,
        tag: '交通简讯',
        date: '11-24',
        title: '通往天空冰川与红莲火山的山区铁路全线复通',
        body: '前几日因野生快龙与卡比兽在阶梯峡谷激战，导致前往岩石沙漠、天空冰川及红莲火山的铁路桥与海滨步道受损。经宝可梦救援队连夜抢修，五大生态区现已全线恢复通行！',
        photo: '/sprites/news/news-rail-viaduct.png',
        photoCaption: '午后青碧峡谷高架桥，快龙与皮卡丘伴随复通快车一路巡航护航',
        photos: [
          {
            src: '/sprites/news/news-rail-viaduct.png',
            caption: '午后青碧峡谷高架桥，快龙与皮卡丘伴随复通快车一路巡航护航',
          },
          {
            src: '/sprites/news/news-rail-repaired.png',
            caption: '首班复通快车驶过新修峡谷石桥，远处可见天空冰川与红莲火山',
          },
        ],
        reporter: '交通频道随行记者 · 健太',
        details: [
          '青翠森林、岩石沙漠（仙人掌峡谷）、风暴海岸（热带椰林）、天空冰川（冰晶雪松）与红莲火山（熔岩黑曜石）全部开放。',
          '沿途发现大量稀有野生与飞行系宝可梦在山坡草地间栖息、翱翔，击晕稀有与异色精灵后请把握时机投球收服。',
          '旅途补给站已全面接入掌机系统，随时可查看操作指南或向中心意见箱反馈路况。',
        ],
      },
    ],
  },
  {
    id: 'ed_v1_5',
    version: 'v1.5',
    issueNo: 147,
    date: '11月23日',
    shortDate: '2026-11-23',
    title: '宝可梦中心科研突破：「超进化共鸣」与 16 项永久特训开放',
    subtitle: 'Lv.5 亲密超进化觉醒 · 16 项永久特训 · 官方异色与主题外观上架',
    coverPhoto: '/sprites/news/news-mega-lab.png',
    weatherBrief: '全球科研中心超进化共鸣波频稳定 · 各地友好商店异色外观同步补货中',
    articles: [
      {
        id: 'ann_mega_lab',
        editionId: 'ed_v1_5',
        version: 'v1.5',
        layout: 'lead_banner',
        tag: '研究档案',
        date: '11-23',
        title: '全球研究所突破：「超进化共鸣」与稀有异色外观正式开放',
        body: '当训练家与伙伴亲密度达 Lv.5 时可在战斗齐射中觉醒超进化/超极巨化形态！研究所同步扩充至 16 项永久特训，友好商店则全新上架官方异色与多款主题外观！',
        photo: '/sprites/news/news-mega-lab.png',
        photoCaption: '研究所实拍：悬浮的虹色进化钥石正释放共鸣星辉波动',
        photos: [
          {
            src: '/sprites/news/news-mega-lab.png',
            caption: '研究所实拍：悬浮的虹色进化钥石正释放共鸣星辉波动',
          },
          {
            src: '/sprites/news/news-lab-shiny.png',
            caption: '实验台近景：研究员正在记录异色宝可梦与虹色棱晶的能量波形',
          },
        ],
        reporter: '全球科研特约记者 · 莎莉娜',
        details: [
          '研究所新增「携带上限、气势披带复活、焦点会心、磐石护甲、收服大师、冒险补给包」等共 16 项永久特训。',
          '精灵详情页新增「亲密·外观」档案，解锁 Lv.2–Lv.10 全套亲密度被动奖励。',
          '友好商店全新上架「官方异色 ★」「岩浆裂纹」「苍蓝圣炎」「花见·樱之灵」「太阳法老」等主题外观。',
        ],
      },
      {
        id: 'ann_v1_5_heroes',
        editionId: 'ed_v1_5',
        version: 'v1.5',
        layout: 'archive_right_thumb',
        fullWidth: true,
        tag: '主角档案',
        date: '11-23',
        title: '四位传奇主角与专属觉醒技档案正式接入宝可梦中心终端',
        body: '赤红、小霞、小刚、小茂四位可切换主角携专属像素立绘与觉醒技能树全面开放，通过冒险与委托获取星星沙子即可逐步解锁并强化专属流派！',
        photo: '/sprites/news/news-lab-shiny.png',
        photoCaption: '四主角专属技能树与每日/每周委托系统现已上线',
        photos: [
          {
            src: '/sprites/news/news-lab-shiny.png',
            caption: '四主角专属技能树与每日/每周委托系统现已上线',
          },
        ],
        reporter: '宝可梦中心档案员 · 健太',
        details: [
          '四位主角各自拥有 3 项可升级专属技能，满级后激活高阶觉醒光环效果。',
          '每日委托与每周悬赏同步开放，完成后可直接领取丰厚星星沙子用于研究所特训。',
        ],
      },
    ],
  },
];

/** Flattened list of all announcements across editions (newest first) for tickers & quick previews */
export const DEFAULT_ANNOUNCEMENTS: ServerAnnouncement[] = NEWS_EDITIONS.flatMap(
  (ed) => ed.articles,
);
