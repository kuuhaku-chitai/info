/**
 * 空白地帯 - CountdownServer
 *
 * サーバーサイドでカウントダウン状態を取得し、
 * クライアントコンポーネントに渡すラッパー。
 *
 * このコンポーネントはServer Componentとして動作する。
 */

import { fetchCountdownState } from '@/lib/actions';
import { CountdownDisplay } from './CountdownDisplay';

interface CountdownServerProps {
  /**
   * サイズ
   */
  size?: 'whisper' | 'subtle' | 'presence';
}

/**
 * サーバーサイドでデータを取得してCountdownDisplayに渡す
 */
export async function CountdownServer({
  size = 'subtle',
}: CountdownServerProps) {
  // サーバーサイドでカウントダウン状態を取得
  const countdownState = await fetchCountdownState();

  return (
    <CountdownDisplay
      initialState={countdownState}
      size={size}
    />
  );
}
