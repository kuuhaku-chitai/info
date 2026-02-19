-- ユーザーにアバター画像URLを追加
ALTER TABLE admin_users ADD COLUMN avatar_url TEXT;

-- カウントダウンに計算式パラメータを追加
ALTER TABLE countdown ADD COLUMN monthly_cost INTEGER NOT NULL DEFAULT 80000;
ALTER TABLE countdown ADD COLUMN initial_fund INTEGER NOT NULL DEFAULT 2300000;
