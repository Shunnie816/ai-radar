# ai-radar

AI関連情報の自動収集・要約・蓄積システム。個人利用前提。

## プロジェクト構成

```
ai-radar/
├── apps/web/        # Next.js 16 (App Router) Web UI
├── n8n/workflows/   # n8n ワークフロー定義（JSON export）
├── docs/            # 要件定義・設計ドキュメント
└── docker-compose.yml
```

## 技術スタック

- **ワークフロー**: n8n (self-hosted, Docker) — `n8nio/n8n:latest`
- **AI**: Claude API — `claude-sonnet-4-6` ※OpenAI切り替え可能な設計
- **DB**: Firebase Firestore
- **Web UI**: Next.js 16 (App Router)
- **ホスティング**: Firebase App Hosting
- **ドメイン**: 自己所有ドメインのサブドメイン

## 詳細ドキュメント

- [要件定義](docs/requirements.md)
- [システム設計](docs/design.md)

## Git運用ルール

- 作業はブランチを切って進める（main / develop で直接作業しない）
- ブランチの粒度はPhaseごと、もしくは大きな作業まとまりごと
- ブランチ命名規則: `feature/phase-N-description`（例: `feature/phase-2-n8n`）
- ブランチ戦略:
  - `feature/*` → `develop`（Phase完了時にPR）
  - `develop` → `main`（動作確認済みのタイミングでPR）
