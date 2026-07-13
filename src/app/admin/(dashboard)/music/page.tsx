/**
 * 空白地帯 - 音楽管理ページ（/admin/music）
 *
 * music Mode（空間の記憶を聴く）の制御室。
 * ここも空白地帯の一部——数字を誇示せず、必要な操作だけが静かに並ぶ。
 * 「本日 1/3」の使用回数も微かに記すだけ（コスト意識は仕組みが守る）。
 */

import { fetchMusicAdminData } from '@/lib/music/musicActions';
import { ModeSwitch } from './ModeSwitch';
import { RebuildButton } from './RebuildButton';
import { ScheduleForm } from './ScheduleForm';
import { TemplateList } from './TemplateList';
import type { MusicGenerationLog } from '@/types';

export const dynamic = 'force-dynamic';

/** ログのステータスを静かな日本語へ */
const STATUS_LABELS: Record<MusicGenerationLog['status'], string> = {
  success: '成功',
  failed: '失敗',
  skipped: '見送り',
  started: '進行中（または中断）',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function MusicAdminPage() {
  const data = await fetchMusicAdminData();
  const { settings, templates, logs, todayCount, dailyLimit, discordConfigured } = data;

  return (
    <div className="space-y-10 max-w-3xl">
      {/* ヘッダー */}
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">音楽</h1>
        <p className="text-xs text-ghost mt-1">
          空間の記憶を聴く — 本日の採取 {todayCount}/{dailyLimit}
          {!discordConfigured && (
            <span className="ml-3 opacity-70">Discord通知: 未設定（DISCORD_WEBHOOK_URL）</span>
          )}
        </p>
      </div>

      {/* 更新モードと再構築 */}
      <section className="space-y-4">
        <h2 className="text-xs text-ghost tracking-[0.3em]">更新モード</h2>
        <ModeSwitch current={settings.mode} />
        <RebuildButton
          remaining={Math.max(0, dailyLimit - todayCount)}
          isGenerating={settings.isGenerating}
        />
      </section>

      {/* スケジュール（Auto時のみ意味を持つ） */}
      <section className="space-y-4">
        <h2 className="text-xs text-ghost tracking-[0.3em]">
          自動採取の時刻（JST）
          {settings.mode === 'manual' && (
            <span className="ml-3 normal-case tracking-normal opacity-70">
              — 手動モードのため休止中
            </span>
          )}
        </h2>
        <ScheduleForm
          morning={settings.scheduleMorning}
          noon={settings.scheduleNoon}
          evening={settings.scheduleEvening}
        />
      </section>

      {/* プロンプトテンプレート */}
      <section className="space-y-4">
        <h2 className="text-xs text-ghost tracking-[0.3em]">プロンプトテンプレート</h2>
        <p className="text-[11px] text-ghost">
          {'{keywords} {density} {trend}'} はHistoryの状態から静かな語彙に置換される。
          各役割で有効かつ順序が最小のものが使われる。
        </p>
        <TemplateList templates={templates} />
      </section>

      {/* 使用ログ */}
      <section className="space-y-4">
        <h2 className="text-xs text-ghost tracking-[0.3em]">採取の記録</h2>
        {logs.length === 0 ? (
          <p className="text-xs text-ghost py-6 text-center">まだ何も採取されていない。</p>
        ) : (
          <ul className="space-y-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-baseline gap-4 px-3 py-2 border border-edge rounded text-xs"
              >
                <span className="text-ghost tabular-nums">{formatDateTime(log.createdAt)}</span>
                <span className="text-ghost">{log.triggerType === 'auto' ? '自動' : '手動'}</span>
                <span className={log.status === 'failed' ? 'text-ink' : 'text-ghost'}>
                  {STATUS_LABELS[log.status]}
                </span>
                {typeof log.durationMs === 'number' && (
                  <span className="text-ghost opacity-70">{Math.round(log.durationMs / 1000)}秒</span>
                )}
                {log.error && (
                  <span className="text-ghost opacity-70 truncate flex-1" title={log.error}>
                    {log.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
