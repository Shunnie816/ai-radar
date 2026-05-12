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
- **作業ブランチは必ず `main` から切る**
- **`main` への直接 commit・push は禁止。** 必ず Issue 起点でブランチを切ること
- PR タイトル: Conventional Commits 形式（`feat:` / `fix:` / `chore:` / `docs:` など）
- PR には必ず `Closes #{番号}` を記載 → main マージ時に Issue が自動クローズ
- マージフロー: `作業ブランチ（main起点）` → `main`（squash merge）
- リリース単位はタグ（`vX.Y.Z`）で管理する

### ブランチ命名規則

ラベルに応じてプレフィックスを使い分ける。形式: `{prefix}/issue-{番号}-{タイトルのslug}`

| ラベル | プレフィックス | 例 |
|---|---|---|
| `bug` | `fix/` | `fix/issue-5-rss-parse-error` |
| `documentation` | `docs/` | `docs/issue-18-claude-md` |
| `infra` / `data` | `chore/` | `chore/issue-9-add-rss-source` |
| `enhancement` / `ui` / `prompt` | `feature/` | `feature/issue-12-readme` |

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

### PR テンプレート

PR 作成時は以下のフォーマットに従う。

```markdown
## 概要

<!-- 変更内容を簡潔に -->

## 対応 Issue

Closes #{番号}

## 変更内容

-

## 確認事項

- [ ] ビルド・型チェックが通ること
- [ ] Lint エラーがないこと
```

### チェック実行の役割分担

lint・build の二重実行を防ぐため、実行主体を明確に分ける。

| チェック | Claude Code | CI |
|---|---|---|
| 型チェック（functions） | ✅ `cd functions && npx tsc --noEmit` | ✅ |
| ビルド（apps/web） | ✅ `cd apps/web && npm run build` | ✅ |
| Lint | 手動可（任意） | ✅ |

### 利用可能なスクリプト

**functions/**

```bash
npm run build        # TypeScript コンパイル
npm run build:watch  # ウォッチモード
npm run serve        # エミュレーター起動
npm run deploy       # Cloud Functions デプロイ
npm run lint         # ESLint 実行
```

**apps/web/**

```bash
npm run dev    # 開発サーバー起動 (localhost:3000)
npm run build  # プロダクションビルド
npm run start  # プロダクションサーバー起動
npm run lint   # ESLint 実行
```

### functions/ の変更時

- コミット前に必ず `cd functions && npx tsc --noEmit` で型エラーがないことを確認する
- デプロイ: `firebase deploy --only functions`
- デプロイ後は Cloud Scheduler で手動実行して動作確認する

### Web UI の変更時

- コミット前に必ず `cd apps/web && npm run build` でビルドが通ることを確認する
- main への PR マージで Firebase App Hosting が自動デプロイ

### コミットの粒度

- 1 Issue = 1 ブランチ = 複数コミット OK（ただし 1 コミット = 1 責務）
- 無関係な変更をまとめてコミットしない

---

## サブエージェント戦略

`Agent` ツールでサブタスクを委任するとき、以下の基準でモデルを選ぶ。

| タスク種別 | モデル | 具体例 |
|---|---|---|
| ファイル探索・コード調査 | `haiku` | Explore agent、glob、grep |
| 通常の実装・テスト・PR 作成 | `sonnet` | 機能実装、テストコード生成 |
| 複雑な設計・アーキテクチャ判断 | `opus` | 設計方針の検討、大規模リファクタ |
