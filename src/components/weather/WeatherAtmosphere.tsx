/**
 * 空白地帯 - 天候演出コンポーネント
 *
 * CSSアニメーションのみで自然現象を表現。
 * 画面中央のセーフゾーンを避け、周囲で静かに演出を展開。
 *
 * コンセプト:
 * - 「空白」を殺さない - 演出は控えめで存在を主張しない
 * - ゆったりとした時間軸 - 急激な変化を避ける
 * - モバイルでも軽量に動作
 */

'use client';

import { useWeather, type WeatherType } from '@/hooks/useWeather';

// 天候ごとのコンポーネント
// 各天候は異なる視覚効果を持つが、すべて控えめに設計

/**
 * 晴天 - 画面端から微かな光のゆらぎ
 * レンズフレアのような柔らかなグラデーションがゆっくり動く
 */
function SunnyEffect({ opacity }: { opacity: number }) {
  return (
    <div
      className="weather-layer weather-sunny"
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* 右上からの光源 */}
      <div className="sunny-flare sunny-flare-1" />
      {/* 左下からの反射光 */}
      <div className="sunny-flare sunny-flare-2" />
    </div>
  );
}

/**
 * 曇り - 薄いグレーの大きな形がゆっくりと横切る
 * 雲の「存在」ではなく「影」を表現
 */
function CloudyEffect({ opacity }: { opacity: number }) {
  return (
    <div
      className="weather-layer weather-cloudy"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />
    </div>
  );
}

/**
 * 雨 - 細く繊細な線が斜めに静かに降り注ぐ
 * 中央を避け、画面の左右端で降る
 */
function RainEffect({ opacity }: { opacity: number }) {
  // 雨粒を生成（左右の領域にのみ配置）
  const raindrops = Array.from({ length: 40 }, (_, i) => {
    // 左側（0-20%）と右側（80-100%）にのみ配置
    const side = i < 20 ? 'left' : 'right';
    const basePosition = side === 'left' ? Math.random() * 20 : 80 + Math.random() * 20;
    return {
      id: i,
      left: `${basePosition}%`,
      animationDelay: `${Math.random() * 4}s`,
      animationDuration: `${2 + Math.random() * 2}s`,
    };
  });

  return (
    <div
      className="weather-layer weather-rain"
      style={{ opacity }}
      aria-hidden="true"
    >
      {raindrops.map((drop) => (
        <div
          key={drop.id}
          className="raindrop"
          style={{
            left: drop.left,
            animationDelay: drop.animationDelay,
            animationDuration: drop.animationDuration,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 雷 - 数分に一度、画面全体がほんの一瞬だけ明るくなる
 * フラッシュは非常に短く、目立たないように
 */
function LightningEffect({ opacity }: { opacity: number }) {
  return (
    <div
      className="weather-layer weather-lightning"
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* 曇り空の背景 */}
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      {/* 稲光のフラッシュ */}
      <div className="lightning-flash" />
    </div>
  );
}

/**
 * 雪 - 小さな白い粒が不規則に、ゆっくりと舞い落ちる
 * 12〜2月のみ有効（フックで制御済み）
 */
function SnowEffect({ opacity }: { opacity: number }) {
  // 雪片を生成（全画面に配置するが、密度は低め）
  const snowflakes = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 8}s`,
    animationDuration: `${8 + Math.random() * 6}s`,
    size: `${2 + Math.random() * 3}px`,
    horizontalDrift: `${-20 + Math.random() * 40}px`,
  }));

  return (
    <div
      className="weather-layer weather-snow"
      style={{ opacity }}
      aria-hidden="true"
    >
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: flake.left,
            animationDelay: flake.animationDelay,
            animationDuration: flake.animationDuration,
            width: flake.size,
            height: flake.size,
            ['--horizontal-drift' as string]: flake.horizontalDrift,
          }}
        />
      ))}
    </div>
  );
}

// 天候タイプに対応するエフェクトコンポーネントをマップ
type EffectComponent = (props: { opacity: number }) => React.ReactNode;
const weatherEffects: Record<WeatherType, EffectComponent> = {
  sunny: SunnyEffect,
  cloudy: CloudyEffect,
  rain: RainEffect,
  lightning: LightningEffect,
  snow: SnowEffect,
};

/**
 * メインの天候演出コンポーネント
 * 天候の切り替えはゆったりとしたトランジションで行う
 */
export function WeatherAtmosphere() {
  const { current, previous, isTransitioning } = useWeather();

  const CurrentEffect = weatherEffects[current];
  const PreviousEffect = previous ? weatherEffects[previous] : null;

  return (
    <div className="weather-container" aria-hidden="true">
      {/* 前の天候（フェードアウト中） */}
      {isTransitioning && PreviousEffect && (
        <PreviousEffect opacity={0} />
      )}

      {/* 現在の天候（フェードイン中または完全表示） */}
      <CurrentEffect opacity={1} />
    </div>
  );
}
