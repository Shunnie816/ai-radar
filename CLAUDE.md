# ai-radar

AI関連情報の自動収集・要約・蓄積システム。個人利用前提。

## プロジェクト構成

```
ai-radar/
├── apps/web/        # Next.js 16 (App Router) Web UI
├── functions/       # Cloud Functions（ワークフロー・スケジューラー）
└── docs/            # 設計ドキュメント
```

## 技術スタック

- **ワークフロー**: Cloud Functions (Firebase) — Node.js 22
- **スケジュール**: Cloud Scheduler（毎日 06:00 JST、Cloud Functions に内包）
- **AI**: Claude API — `claude-sonnet-4-6`
- **DB**: Firebase Firestore
- **Web UI**: Next.js 16 (App Router)
- **ホスティング**: Firebase App Hosting
- **ドメイン**: https://ai-radar.shunniehub.com/

## 詳細ドキュメント

- [システム設計](docs/design.md)
- [要件定義](docs/requirements.md)

---

## 開発ルール

### Issue・ブランチ・PR の運用

- **すべての作業は Issue から始める**（GitHub Issues でタスク管理）
- ブランチ命名: `feature/issue-{番号}-{説明}`（例: `feature/issue-12-readme`）
- PR タイトル: Conventional Commits 形式（`feat:` / `fix:` / `chore:` / `docs:` など）
- PR 本文に `Closes #{番号}` を記載 → develop マージ時に Issue が自動クローズ
- マージフロー: `feature/*` → `develop` → `main`

### ラベルの使い分け

| ラベル | 用途 |
|---|---|
| `enhancement` | 機能追加・改善 |
| `bug` | バグ修正 |
| `documentation` | ドキュメント |
| `ui` | UI/UX 改善 |
| `prompt` | プロンプト・AI 改善 |
| `infra` | インフラ・Cloud Functions |
| `data` | データ収集・RSSソース |

### functions/ の変更時

- 必ず `cd functions && npx tsc --noEmit` でビルドエラーがないことを確認してからコミット
- デプロイ: `firebase deploy --only functions`
- デプロイ後は Cloud Scheduler で手動実行して動作確認する

### Web UI の変更時

- 必ず `cd apps/web && npm run build` でビルドが通ることを確認してからコミット
- main への PR マージで Firebase App Hosting が自動デプロイ

### コミットの粒度

- 1 Issue = 1 ブランチ = 複数コミット OK（ただし 1 コミット = 1 責務）
- 無関係な変更をまとめてコミットしない
