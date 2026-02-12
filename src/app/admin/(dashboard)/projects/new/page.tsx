/**
 * 空白地帯 - 新規プロジェクトページ
 */

import Link from 'next/link';
import { ProjectForm } from '../ProjectForm';

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">新規プロジェクト</h1>
          <p className="text-xs text-ghost mt-1">
            新しいプロジェクトを作成する
          </p>
        </div>
        <Link
          href="/projects"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <ProjectForm />
    </div>
  );
}
