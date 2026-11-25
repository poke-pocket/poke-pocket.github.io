import React, { useState } from 'react';
import { sound } from '../utils/sound';
import { PixelIcon } from './PixelSprite';

interface LandscapeFullscreenCoverProps {
  visible: boolean;
  isManualGuide: boolean;
  supportsFullscreen: boolean;
  onEnterFullscreen: () => Promise<{ ok: boolean; reason?: 'unsupported' | 'failed' }>;
  onDismiss: () => void;
}

export const LandscapeFullscreenCover: React.FC<LandscapeFullscreenCoverProps> = ({
  visible,
  isManualGuide,
  supportsFullscreen,
  onEnterFullscreen,
  onDismiss,
}) => {
  const [fallbackHint, setFallbackHint] = useState(false);

  if (!visible) return null;

  const canDirectFullscreen = supportsFullscreen && !fallbackHint;

  const handleEnter = async () => {
    sound.play('confirm');
    const res = await onEnterFullscreen();
    if (res.ok) {
      setFallbackHint(false);
    } else {
      setFallbackHint(true);
    }
  };

  return (
    <div
      className="fs-landscape-cover"
      role="dialog"
      aria-modal="true"
      aria-label="横屏全屏提示"
    >
      <div className="fs-landscape-card">
        <div className="fs-landscape-head">
          <span className="fs-landscape-badge">
            <PixelIcon name="fullscreen" size={12} />
            <span>{isManualGuide ? '全屏显示指引' : '检测到横屏模式'}</span>
          </span>
          <button
            type="button"
            className="lcd-mini-close"
            onClick={() => {
              sound.play('cancel');
              setFallbackHint(false);
              onDismiss();
            }}
          >
            跳过
          </button>
        </div>

        <h3 className="fs-landscape-title">
          {canDirectFullscreen ? '建议开启浏览器全屏游玩' : '开启全屏获得完整掌机视野'}
        </h3>

        {canDirectFullscreen ? (
          <p className="fs-landscape-desc">
            已检测到当前为横屏界面！开启全屏模式可隐藏浏览器地址栏与工具栏，获得完整宽屏 3D 像素视野与更顺手的摇杆操作。
          </p>
        ) : (
          <div className="fs-landscape-ios-tip">
            <p>
              当前浏览器暂不支持网页一键全屏（如 iOS Safari），推荐用以下任一方式获得真全屏体验：
            </p>
            <ul>
              <li>轻点地址栏左侧 <strong>「AA / 大小」</strong> → 选择 <strong>「隐藏工具栏」</strong></li>
              <li>或点击底部 <strong>「分享」</strong> → <strong>「添加到主屏幕」</strong> 以独立掌机 App 启动</li>
            </ul>
          </div>
        )}

        <div className="fs-landscape-actions">
          {canDirectFullscreen ? (
            <>
              <button
                type="button"
                className="fs-landscape-btn is-primary"
                onClick={handleEnter}
              >
                <PixelIcon name="fullscreen" size={14} />
                <span>一键进入横屏全屏</span>
              </button>
              <button
                type="button"
                className="fs-landscape-btn"
                onClick={() => {
                  sound.play('cancel');
                  onDismiss();
                }}
              >
                暂不开启，继续游玩
              </button>
            </>
          ) : (
            <button
              type="button"
              className="fs-landscape-btn is-primary"
              onClick={() => {
                sound.play('confirm');
                setFallbackHint(false);
                onDismiss();
              }}
            >
              我知道了，继续游玩
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
