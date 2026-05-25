#!/usr/bin/env node

/**
 * 空白地帯 - ローカル環境 管理者アカウント管理スクリプト
 *
 * ローカルD1エミュレータ上の `admin_users` テーブルに対して、
 * パスワードの確認（検証）および更新（リセット）を行います。
 * （※パスワードは一方向ハッシュ化されているため、平文の直接確認はできません）
 *
 * 使い方:
 *   node scripts/manage-local-admin.mjs verify <username> <password>
 *   node scripts/manage-local-admin.mjs reset <username> <new_password>
 *   node scripts/manage-local-admin.mjs list
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// データベースパスの解決 (restore-from-prod.js と同じロジック)
const DB_DIR = path.join(import.meta.dirname, '..', '.wrangler', 'state', 'v3', 'd1');
const DB_PATH = path.join(DB_DIR, 'kuuhaku-chitai.sqlite');

// PBKDF2 設定 (src/lib/auth.ts に合わせる)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = 'sha256';
const KEY_LENGTH = 32;

// ============================================
// パスワード処理
// ============================================

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_HASH);
    return `pbkdf2:${PBKDF2_ITERATIONS}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = parseInt(parts[1], 10);
    const salt = Buffer.from(parts[2], 'hex');
    const expectedHash = Buffer.from(parts[3], 'hex');

    const hash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, PBKDF2_HASH);

    // バイト長が異なる場合はエラーになるためチェック
    if (hash.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(hash, expectedHash);
}

// ============================================
// メイン処理
// ============================================

function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!['verify', 'reset', 'list'].includes(command)) {
        console.log(`
使い方:
  node scripts/manage-local-admin.mjs list
    -> ローカルDBに登録されている管理者アカウント名の一覧を表示します。

  node scripts/manage-local-admin.mjs verify <username> <password>
    -> 指定したユーザー名のパスワードが正しいか検証します。

  node scripts/manage-local-admin.mjs reset <username> <new_password>
    -> 指定したユーザーのパスワードを新しいパスワードに上書き（リセット）します。
`);
        process.exit(1);
    }

    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ ローカルデータベースが見つかりません。`);
        console.error(`パス: ${DB_PATH}`);
        console.error(`(先に pnpm run dev や db:restore などを実行してローカルDBを作成してください)`);
        process.exit(1);
    }

    const db = new Database(DB_PATH);

    try {
        if (command === 'list') {
            const users = db.prepare('SELECT id, username, display_name FROM admin_users').all();
            if (users.length === 0) {
                console.log('ローカルDBには管理者ユーザーが1人も登録されていません。（またはテーブルが空です）');
            } else {
                console.log('■ 登録されている管理者ユーザー:');
                users.forEach(u => {
                    console.log(`  - ${u.username} (表示名: ${u.display_name || '未設定'})`);
                });
            }
        }
        else if (command === 'verify') {
            const username = args[1];
            const password = args[2];

            if (!username || !password) {
                console.error('❌ エラー: ユーザー名とパスワードを指定してください。');
                process.exit(1);
            }

            const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
            if (!user) {
                console.error(`❌ エラー: ユーザー '${username}' は見つかりませんでした。`);
                process.exit(1);
            }

            const isValid = verifyPassword(password, user.password_hash);
            if (isValid) {
                console.log(`✅ パスワードは正しいです！ (ユーザー: ${username})`);
            } else {
                console.error(`❌ パスワードが間違っています。 (ユーザー: ${username})`);
                process.exit(1);
            }
        }
        else if (command === 'reset') {
            const username = args[1];
            const newPassword = args[2];

            if (!username || !newPassword) {
                console.error('❌ エラー: ユーザー名と新しいパスワードを指定してください。');
                process.exit(1);
            }

            const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

            const newHash = hashPassword(newPassword);

            if (!user) {
                console.log(`⚠️ ユーザー '${username}' は見つかりませんでした。新しく作成します！`);
                db.prepare('INSERT INTO admin_users (id, username, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(crypto.randomUUID(), username, username, newHash, new Date().toISOString(), new Date().toISOString());
                console.log(`✅ ユーザー '${username}' を新しく作成しました。`);
                console.log(`設定されたパスワード: ${newPassword}`);
            } else {
                db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE username = ?')
                    .run(newHash, new Date().toISOString(), username);
                console.log(`✅ ユーザー '${username}' のパスワードを正常に変更（リセット）しました。`);
                console.log(`新しいパスワード: ${newPassword}`);
            }
        }
    } catch (err) {
        if (err.message.includes('no such table')) {
            console.error('❌ エラー: テーブルが存在しません。マイグレーションが完了していない可能性があります。');
        } else {
            console.error('❌ エラーが発生しました:', err.message);
        }
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
