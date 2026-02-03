/**
 * 空白地帯 - 天候取得フック
 *
 * Open-Meteo APIから現在地の天候を取得し、
 * 取得失敗時は内部シミュレーションモードにフォールバック。
 *
 * 天候の種類:
 * - sunny: 晴天 - 柔らかな光のゆらぎ
 * - cloudy: 曇り - 薄いグレーの雲がゆっくり横切る
 * - rain: 雨 - 細く繊細な線が斜めに降り注ぐ
 * - lightning: 雷 - 数分に一度、画面が一瞬明るくなる
 * - snow: 雪 - 12〜2月のみ、小さな白い粒がゆっくり舞い落ちる
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'lightning' | 'snow';

interface WeatherState {
  current: WeatherType;
  previous: WeatherType | null;
  isTransitioning: boolean;
  isSimulationMode: boolean;
}

// Open-Meteo WMO天気コードを内部の天候タイプに変換
// 空白を殺さない観点から、微弱な演出のみを使用
function wmoCodeToWeatherType(code: number, isWinterMonth: boolean): WeatherType {
  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs

  // 雷雨 (95-99)
  if (code >= 95) return 'lightning';

  // 雪 (71-77, 85-86) - 冬季のみ
  if (isWinterMonth && ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))) {
    return 'snow';
  }

  // 雨 (51-67, 80-82)
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }

  // 曇り (2-3, 45-48)
  if (code >= 2 && code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'cloudy';

  // 晴れ (0-1)
  return 'sunny';
}

// 現在の月が冬（12月、1月、2月）かどうか
function isWinter(): boolean {
  const month = new Date().getMonth();
  return month === 11 || month === 0 || month === 1; // 11=Dec, 0=Jan, 1=Feb
}

// シミュレーション用の天候候補（雪は冬季のみ）
function getSimulationCandidates(): WeatherType[] {
  const base: WeatherType[] = ['sunny', 'cloudy', 'rain', 'lightning'];
  if (isWinter()) {
    base.push('snow');
  }
  return base;
}

// ランダムな天候を選択（重み付け）
// 晴れ > 曇り > 雨 > 雪 > 雷 の順に発生確率を設定
function getRandomWeather(exclude?: WeatherType): WeatherType {
  const candidates = getSimulationCandidates();
  const weights: Record<WeatherType, number> = {
    sunny: 40,
    cloudy: 30,
    rain: 20,
    snow: isWinter() ? 8 : 0,
    lightning: 2,
  };

  const filtered = candidates.filter((w) => w !== exclude);
  const totalWeight = filtered.reduce((sum, w) => sum + weights[w], 0);
  let random = Math.random() * totalWeight;

  for (const weather of filtered) {
    random -= weights[weather];
    if (random <= 0) return weather;
  }

  return 'sunny';
}

// シミュレーションの天候変化間隔（ミリ秒）
// 30秒〜2分のランダムな間隔で変化
function getSimulationInterval(): number {
  return 30000 + Math.random() * 90000; // 30秒 〜 2分
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    current: 'sunny',
    previous: null,
    isTransitioning: false,
    isSimulationMode: false,
  });

  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 天候をセット（トランジション付き）
  // 30秒かけてゆったりとフェードイン/フェードアウト
  const setWeatherWithTransition = useCallback(
    (newWeather: WeatherType) => {
      if (newWeather === state.current) return;

      setState((prev) => ({
        ...prev,
        previous: prev.current,
        current: newWeather,
        isTransitioning: true,
      }));

      // トランジション完了後にフラグをリセット
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      transitionTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          previous: null,
          isTransitioning: false,
        }));
      }, 30000); // 30秒のトランジション
    },
    [state.current]
  );

  // シミュレーションモードの開始
  const startSimulation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isSimulationMode: true,
    }));

    function scheduleNextChange() {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }

      simulationTimeoutRef.current = setTimeout(() => {
        const nextWeather = getRandomWeather(state.current);
        setWeatherWithTransition(nextWeather);
        scheduleNextChange();
      }, getSimulationInterval());
    }

    scheduleNextChange();
  }, [setWeatherWithTransition, state.current]);

  // Open-Meteo APIから天候を取得
  const fetchWeather = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code&timezone=auto`
        );

        if (!response.ok) {
          throw new Error('API request failed');
        }

        const data = await response.json();
        const weatherCode = data.current?.weather_code;

        if (typeof weatherCode !== 'number') {
          throw new Error('Invalid weather code');
        }

        const weather = wmoCodeToWeatherType(weatherCode, isWinter());
        setWeatherWithTransition(weather);

        // 15分ごとに再取得
        setTimeout(() => {
          fetchWeather(latitude, longitude);
        }, 15 * 60 * 1000);
      } catch {
        // API失敗時はシミュレーションモードに移行
        startSimulation();
      }
    },
    [setWeatherWithTransition, startSimulation]
  );

  // 位置情報を取得して天候を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Geolocation APIが利用可能かチェック
    if (!navigator.geolocation) {
      startSimulation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      () => {
        // 位置情報が拒否された場合はシミュレーションモード
        startSimulation();
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000, // 10分間キャッシュ
      }
    );

    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [fetchWeather, startSimulation]);

  return state;
}
