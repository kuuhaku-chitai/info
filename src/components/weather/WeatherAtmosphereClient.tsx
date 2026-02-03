/**
 * 空白地帯 - 天候演出クライアントラッパー
 *
 * Server Componentから使用するためのクライアントコンポーネント。
 * SSRを無効化して、ブラウザでのみ位置情報を取得・天候を表示する。
 */

'use client';

import dynamic from 'next/dynamic';

// SSRを無効化してクライアントサイドのみでレンダリング
const WeatherAtmosphere = dynamic(
  () => import('./WeatherAtmosphere').then(mod => mod.WeatherAtmosphere),
  { ssr: false }
);

export function WeatherAtmosphereClient() {
  return <WeatherAtmosphere />;
}
