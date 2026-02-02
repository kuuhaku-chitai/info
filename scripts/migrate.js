#!/usr/bin/env node

/**
 * 空白地帯 - データベースマイグレーションスクリプト
 *
 * ローカル開発用のSQLiteデータベースを初期化する。
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');
const DB_PATH = path.join(DB_DIR, 'kuuhaku-chitai.sqlite');
const MIGRATION_PATH = path.join(__dirname, '..', 'migrations', '0001_initial.sql');

console.log('🗄️  データベースマイグレーションを開始...');

// ディレクトリ作成
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('📁 ディレクトリを作成:', DB_DIR);
}

// データベース接続
const db = new Database(DB_PATH);
console.log('📂 データベース:', DB_PATH);

// マイグレーション実行
if (fs.existsSync(MIGRATION_PATH)) {
  const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  db.exec(migration);
  console.log('✅ マイグレーション完了');
} else {
  console.error('❌ マイグレーションファイルが見つかりません:', MIGRATION_PATH);
  process.exit(1);
}

// 確認
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📊 テーブル:', tables.map(t => t.name).join(', '));

const countdown = db.prepare('SELECT * FROM countdown').get();
if (countdown) {
  console.log('⏱️  カウントダウン初期値:');
  console.log('   開始日:', countdown.start_date);
  console.log('   初期秒数:', countdown.initial_total_seconds.toLocaleString());
}

db.close();
console.log('🎉 セットアップ完了！');
console.log('');
console.log('次のステップ:');
console.log('  1. docker compose up -d  (MinIO起動)');
console.log('  2. npm run dev           (開発サーバー起動)');
console.log('  3. http://localhost:3000/admin にアクセス');
