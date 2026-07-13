'use server';

/**
 * 空白地帯 - Music Mode 管理用 Server Actions
 *
 * 管理画面（/admin/music）が使う読み書きの入口。
 * すべての変更系アクションは冒頭でセッションを検証する——
 * 管理画面のレイアウトゲートに加えた二重の守り
 * （Server Actionは理論上どこからでも呼べるため）。
 *
 * Rebuild Ensembleはここに置かない：生成の入口は
 * /api/music/rebuild（→ runEnsembleGeneration）の一本に保つ。
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { notifyMusicEvent } from '@/lib/discord';
import {
  getMusicSettings,
  updateMusicMode,
  updateMusicSchedule,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getGenerationLogs,
  countTodaySuccess,
} from './musicDb';
import { jstDayStartUtcIso, DAILY_GENERATION_LIMIT } from './guard';
import type {
  MusicSettings,
  MusicUpdateMode,
  MusicPromptTemplate,
  MusicGenerationLog,
  StemRole,
} from '@/types';

/** 変更系アクション共通の認証ゲート */
async function requireAdmin(): Promise<void> {
  const user = await getSession();
  if (!user) throw new Error('認証が必要です');
}

// ============================================
// 読み取り（管理画面の初期データ）
// ============================================

export interface MusicAdminData {
  settings: MusicSettings;
  templates: MusicPromptTemplate[];
  logs: MusicGenerationLog[];
  /** 本日（JST）の成功済み生成回数 */
  todayCount: number;
  /** 1日の上限（表示用） */
  dailyLimit: number;
  /** Discord Webhookが設定されているか（URLそのものは渡さない） */
  discordConfigured: boolean;
}

export async function fetchMusicAdminData(): Promise<MusicAdminData> {
  const [settings, templates, logs, todayCount, webhookUrl] = await Promise.all([
    getMusicSettings(),
    getAllTemplates(),
    getGenerationLogs(30),
    countTodaySuccess(jstDayStartUtcIso(new Date())),
    getEnv('DISCORD_WEBHOOK_URL'),
  ]);
  return {
    settings,
    templates,
    logs,
    todayCount,
    dailyLimit: DAILY_GENERATION_LIMIT,
    discordConfigured: Boolean(webhookUrl),
  };
}

// ============================================
// モード切替
// ============================================

export async function setMusicMode(mode: MusicUpdateMode): Promise<void> {
  await requireAdmin();
  if (mode !== 'auto' && mode !== 'manual') {
    throw new Error('不正なモードです');
  }
  await updateMusicMode(mode);
  // モードの切り替えは音楽の生死に関わる変化——静かに知らせる
  await notifyMusicEvent(
    '更新モード切替',
    mode === 'auto' ? '自動（朝・昼・晩）へ' : '手動のみへ（自動更新は停止）',
  );
  revalidatePath('/admin/music');
}

// ============================================
// スケジュール（Auto時の生成時刻）
// ============================================

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveMusicSchedule(
  morning: string,
  noon: string,
  evening: string,
): Promise<void> {
  await requireAdmin();
  for (const value of [morning, noon, evening]) {
    if (!TIME_PATTERN.test(value)) {
      throw new Error(`時刻の形式が不正です: ${value}（HH:MM）`);
    }
  }
  await updateMusicSchedule(morning, noon, evening);
  revalidatePath('/admin/music');
}

// ============================================
// プロンプトテンプレート CRUD
// ============================================

const VALID_ROLES: StemRole[] = ['rhythm', 'bass', 'melody', 'atmosphere'];
const MAX_NAME_LENGTH = 60;
const MAX_TEMPLATE_LENGTH = 300;

/** テンプレート入力の検証。巨大入力や空文字をLyriaへ届く前に堰き止める */
function validateTemplateInput(name: string, template: string): void {
  if (!name.trim()) throw new Error('名前は必須です');
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`名前は${MAX_NAME_LENGTH}文字以内にしてください`);
  }
  if (!template.trim()) throw new Error('テンプレート本文は必須です');
  if (template.length > MAX_TEMPLATE_LENGTH) {
    throw new Error(`テンプレートは${MAX_TEMPLATE_LENGTH}文字以内にしてください`);
  }
}

export async function createMusicTemplate(data: {
  name: string;
  stemRole: StemRole;
  template: string;
  sortOrder: number;
}): Promise<void> {
  await requireAdmin();
  if (!VALID_ROLES.includes(data.stemRole)) throw new Error('不正なstem役割です');
  validateTemplateInput(data.name, data.template);
  await createTemplate({
    id: crypto.randomUUID(),
    name: data.name.trim(),
    stemRole: data.stemRole,
    template: data.template.trim(),
    sortOrder: data.sortOrder,
  });
  revalidatePath('/admin/music');
}

export async function updateMusicTemplate(
  id: string,
  fields: { name: string; template: string; isActive: boolean; sortOrder: number },
): Promise<void> {
  await requireAdmin();
  validateTemplateInput(fields.name, fields.template);
  await updateTemplate(id, {
    name: fields.name.trim(),
    template: fields.template.trim(),
    isActive: fields.isActive,
    sortOrder: fields.sortOrder,
  });
  revalidatePath('/admin/music');
}

export async function deleteMusicTemplate(id: string): Promise<void> {
  await requireAdmin();
  await deleteTemplate(id);
  revalidatePath('/admin/music');
}
