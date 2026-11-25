import React, { useEffect, useState } from 'react';

interface SpriteFit {
  scale: number;
  txPct: number;
  tyPct: number;
}

const spriteFitCache = new Map<string, SpriteFit>();

function computeSpriteFit(img: HTMLImageElement, fillRatio: number): SpriteFit {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return { scale: 1, txPct: 0, tyPct: 0 };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { scale: 1, txPct: 0, tyPct: 0 };
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return { scale: 1, txPct: 0, tyPct: 0 };
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const maxSpan = Math.max(boxW / w, boxH / h);
    const scale = Math.min(2.75, Math.max(0.96, fillRatio / Math.max(0.18, maxSpan)));
    const cx = (minX + maxX + 1) / 2;
    const cy = (minY + maxY + 1) / 2;
    const txPct = (0.5 - cx / w) * 100;
    const tyPct = (0.5 - cy / h) * 100;
    return { scale, txPct, tyPct };
  } catch {
    return { scale: 1, txPct: 0, tyPct: 0 };
  }
}

interface TrimmedSpriteImgProps {
  src: string;
  alt: string;
  size: number;
  fillRatio?: number;
  className?: string;
}

/**
 * Renders any pixel sprite (animated GIF or static PNG, Pokémon or Item)
 * scaled & centered by its tight non-transparent pixel bounding box so tiny
 * Gen-5 sprites with large transparent padding match item icons 1:1 in scale!
 */
export const TrimmedSpriteImg: React.FC<TrimmedSpriteImgProps> = ({
  src,
  alt,
  size,
  fillRatio = 0.84,
  className = '',
}) => {
  const cacheKey = `${src}@${fillRatio.toFixed(2)}`;
  const [fit, setFit] = useState<SpriteFit>(() => spriteFitCache.get(cacheKey) ?? { scale: 1, txPct: 0, tyPct: 0 });

  useEffect(() => {
    const cached = spriteFitCache.get(cacheKey);
    if (cached) setFit(cached);
    else setFit({ scale: 1, txPct: 0, tyPct: 0 });
  }, [cacheKey]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (spriteFitCache.has(cacheKey)) {
      setFit(spriteFitCache.get(cacheKey)!);
      return;
    }
    const next = computeSpriteFit(e.currentTarget, fillRatio);
    spriteFitCache.set(cacheKey, next);
    setFit(next);
  };

  return (
    <span
      className={`trimmed-sprite-box ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={handleLoad}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
          transformOrigin: 'center center',
          transform: `scale(${fit.scale.toFixed(3)}) translate(${fit.txPct.toFixed(2)}%, ${fit.tyPct.toFixed(2)}%)`,
        }}
      />
    </span>
  );
};
