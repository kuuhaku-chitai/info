#!/usr/bin/env node

/**
 * 空白地帯 - データベースマイグレーションスクリプト
 *
 * ローカル開発用のSQLiteデータベースを初期化・更新する。
 * migrationsディレクトリ内のすべての.sqlファイルを順番に実行。
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');
const DB_PATH = path.join(DB_DIR, 'kuuhaku-chitai.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

console.log('🗄️  データベースマイグレーションを開始...');

// ディレクトリ作成
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('📁 ディレクトリを作成:', DB_DIR);
}

// データベース接続
const db = new Database(DB_PATH);
console.log('📂 データベース:', DB_PATH);

// マイグレーション履歴テーブルを作成
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// 適用済みマイグレーションを取得
const appliedMigrations = new Set(
  db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
);

// マイグレーションファイルを取得（ソート済み）
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`📋 ${migrationFiles.length}個のマイグレーションファイルを検出`);

// 各マイグレーションを実行
let appliedCount = 0;
for (const filename of migrationFiles) {
  if (appliedMigrations.has(filename)) {
    console.log(`⏭️  スキップ: ${filename} (適用済み)`);
    continue;
  }

  const filePath = path.join(MIGRATIONS_DIR, filename);
  const migration = fs.readFileSync(filePath, 'utf-8');

  console.log(`🔄 実行中: ${filename}`);

  try {
    db.exec(migration);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(filename);
    console.log(`✅ 完了: ${filename}`);
    appliedCount++;
  } catch (error) {
    console.error(`❌ エラー: ${filename}`);
    console.error(error.message);
    process.exit(1);
  }
}

if (appliedCount === 0) {
  console.log('ℹ️  新しいマイグレーションはありません');
} else {
  console.log(`✅ ${appliedCount}個のマイグレーションを適用しました`);
}

// 確認
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_%'").all();
console.log('📊 テーブル:', tables.map(t => t.name).join(', '));

const countdown = db.prepare('SELECT * FROM countdown').get();
if (countdown) {
  console.log('⏱️  カウントダウン状態:');
  console.log('   開始日:', countdown.start_date);
  console.log('   初期秒数:', countdown.initial_total_seconds.toLocaleString());
}

db.close();
console.log('🎉 マイグレーション完了！');
