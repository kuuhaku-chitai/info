'use client';

/**
 * 空白地帯 - CountdownDisplay
 *
 * 「寿命」を秒単位で可視化するコンポーネント。
 * 0に向かって刻々と減少していく数字が、
 * 微かに脈動しながら存在を主張する。
 *
 * コンセプト:
 * - 秒単位で「命」が削られていく様を可視化
 * - 数字の変化は有機的で、機械的にならない
 * - 危機状態では色が変化するが、派手にはしない
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type CountdownState } from '@/types';
import {
  calculateRemainingSeconds,
  isCritical,
  isExpired,
} from '@/lib/countdown';
import { ANIMATION_EASING } from '@/lib/constants';

interface CountdownDisplayProps {
  /**
   * サーバーから取得したカウントダウン状態
   */
  initialState: CountdownState;
  /**
   * サイズ
   * - 'whisper': 極小（コーナー配置用）
   * - 'subtle': 小（デフォルト）
   * - 'presence': 中（メインコンテンツ用）
   */
  size?: 'whisper' | 'subtle' | 'presence';
}

export function CountdownDisplay({
  initialState,
  size = 'subtle',
}: CountdownDisplayProps) {
  // 残り秒数の状態
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    calculateRemainingSeconds(initialState)
  );
  const [isClient, setIsClient] = useState(false);

  // クライアントサイドのカウントダウン
  useEffect(() => {
    setIsClient(true);
    // 初期値を再計算（SSRとクライアントの時刻差を補正）
    setRemainingSeconds(calculateRemainingSeconds(initialState));

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [initialState]);

  const critical = isCritical(remainingSeconds);
  const expired = isExpired(remainingSeconds);

  // サイズに応じたスタイル
  const sizeStyles = {
    whisper: 'text-xs',
    subtle: 'text-sm',
    presence: 'text-lg',
  };

  // SSR時は静的な値を表示
  if (!isClient) {
    return (
      <div className={`font-mono font-light tracking-wider ${sizeStyles[size]} text-[var(--color-ghost)] opacity-50`}>
        ...
      </div>
    );
  }

  return (
    <motion.div
      className={`
        font-mono font-light tracking-wider
        ${sizeStyles[size]}
        ${critical ? 'text-[var(--color-critical)]' : 'text-[var(--color-ghost)]'}
        ${expired ? 'opacity-30' : ''}
      `}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 2,
        ease: ANIMATION_EASING.organic,
      }}
    >
      {expired ? (
        <span className="tracking-[0.3em]">0</span>
      ) : (
        <SecondsCounter value={remainingSeconds} critical={critical} />
      )}
    </motion.div>
  );
}

/**
 * 秒数カウンター
 * 各桁が個別にアニメーションする
 */
function SecondsCounter({
  value,
  critical,
}: {
  value: number;
  critical: boolean;
}) {
  // 数字を文字列に変換してパディング
  const digits = value.toString().split('');

  return (
    <div className="flex items-baseline">
      <AnimatePresence mode="popLayout">
        {digits.map((digit, index) => (
          <motion.span
            key={`${index}-${digit}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{
              opacity: critical ? [0.5, 0.8, 0.5] : [0.6, 1, 0.6],
              y: 0,
            }}
            exit={{ opacity: 0, y: 8 }}
            transition={{
              opacity: {
                duration: 0,
                repeat: Infinity,
                ease: ANIMATION_EASING.dew,
              },
              y: {
                duration: 0,
                ease: ANIMATION_EASING.dew,
              },
            }}
            className="inline-block tabular-nums"
          >
            {digit}
          </motion.span>
        ))}
      </AnimatePresence>
      {/* 単位表示（控えめに） */}
      <motion.span
        className="ml-1 text-[0.6em] opacity-40"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        秒
      </motion.span>
    </div>
  );
}
