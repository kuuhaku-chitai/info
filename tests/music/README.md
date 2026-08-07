# music Mode 検証スイート

純粋関数の回帰テスト。`pnpm run test:music` で全実行。

- 実行系：Node 22の `--experimental-strip-types`（依存ゼロ・ビルド不要）
- `*.test.ts` … 純粋関数（相対importのみ）
- `*.dbtest.mjs` … ローカルSQLite統合（`@/`解決に `alias-loader.mjs` を使用。
  実行前に `pnpm run db:migrate`。実データを汚さないよう自前でシード・掃除・復元する）

かつてはscratchpad（/tmp）に置いていたが、macOSの定期削除で2度消えたため
リポジトリへ移設した（docs/music-mode-spec.md §9の教訓群と同じ精神の運用対策）。
