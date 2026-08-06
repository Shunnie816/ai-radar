# ai-radar

AI関連情報を毎日自動収集・要約し、トレンドを把握するための個人向けシステム。

**URL**: https://ai-radar.shunniehub.com/

[![CI](https://github.com/Shunnie816/ai-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/Shunnie816/ai-radar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 機能

- **自動収集**: 15のRSSソースからAI・テック・セキュリティ関連記事を毎日 06:00 JST に自動取得
- **2段階AI処理**: Haiku が重要度をスコアリング（4軸10点満点）→ high / medium のみ Sonnet が日本語要約（重要度・タグ付き）
- **日次サマリー**: その日のトレンドと主要トピックを high 記事から自動生成
- **閲覧 UI**: ダッシュボード・日次サマリー・記事一覧（キーワード検索・重要度/ソースフィルタ）・記事詳細
- **アカウント機能**: Google ログイン・記事のお気に入り・コメント（投稿/編集/削除）・プロフィール（表示名・アイコン設定、自分の活動一覧）
- **運用監視**: dailyFeed の失敗を Cloud Monitoring ログベースアラートでメール通知（[docs/monitoring.md](docs/monitoring.md)）
- **セキュリティ**: Firestore セキュリティルール + API キーの API 制限による多層防御（[docs/security.md](docs/security.md)）

### RSSソース

| カテゴリ | ソース |
|---|---|
| AI 大手・研究 | OpenAI Blog / Google DeepMind / AWS ML Blog / Google Cloud Blog / Hugging Face Blog / Meta Engineering |
| セキュリティ | The Hacker News / Krebs on Security |
| テック・経済 | Hacker News / TechCrunch / MIT Technology Review / Wired |
| 日本語 | ITmedia AI / Zenn AI / Qiita Popular |

---

## システム構成

```
Cloud Scheduler (毎日 06:00 JST)
  └── Cloud Functions (dailyFeed)
        ├── RSS 取得（15ソース・各5件まで・直近24時間）
        ├── 重複チェック（Firestore の URL と照合）
        ├── 重要度スコアリング（Claude Haiku・10記事/リクエストの一括採点・最大75件）
        │     └── 技術インパクト(0-3) + 実務影響(0-3) + 信頼性(0-2) + トレンド性(0-2) = 10点満点
        │         high: 7-10 / medium: 4-6 / low: 0-3
        ├── high / medium のみ日本語要約（Claude Sonnet・最大30件）
        ├── Firestore に保存（articles: 要約・重要度・スコア・タグ）
        └── 日次サマリー生成・保存（Claude Sonnet・high 記事ベース → daily_summaries）

Firestore ─── Next.js (Firebase App Hosting) ─── ブラウザ
   │
   └── users/{uid}（プロフィール・お気に入り）, articles/{id}/comments（コメント）
       ※ Firebase Auth (Google) + Firestore セキュリティルールで保護
```

- **モデル**: スコアリング `claude-haiku-4-5` / 要約・日次サマリー `claude-sonnet-4-6`
- **デプロイ**: main への push で Functions（GitHub Actions）と Web（App Hosting）が自動デプロイ

---

## 技術スタック

| レイヤー | 採用技術 |
|---|---|
| ワークフロー | Cloud Functions for Firebase (Node.js 22 / TypeScript) |
| スケジュール | Cloud Scheduler（毎日 06:00 JST） |
| AI | Claude API（`@anthropic-ai/sdk`） |
| DB | Firebase Firestore |
| 認証 | Firebase Authentication（Google ログイン） |
| Web UI | Next.js 16 (App Router) / React 19 / Tailwind CSS v4 |
| ホスティング | Firebase App Hosting |
| テスト | Vitest |
| CI/CD | GitHub Actions |

---

## ディレクトリ構成

```
ai-radar/
├── apps/web/        # Next.js 16 (App Router) Web UI
├── functions/       # Cloud Functions（収集・スコアリング・要約ワークフロー）
├── scripts/         # 運用スクリプト（監視アラート設定など）
└── docs/            # 設計・要件・運用ドキュメント
```

---

## セットアップ（ローカル開発）

### 前提

- Node.js 22
- Firebase プロジェクト（Firestore / Authentication / App Hosting を有効化）
- [Anthropic API](https://console.anthropic.com/) のキー

### 手順

```bash
git clone https://github.com/Shunnie816/ai-radar.git
cd ai-radar
```

**Web UI**

```bash
cd apps/web
npm ci
cp ../../.env.example .env.local   # NEXT_PUBLIC_FIREBASE_* を自分のプロジェクトの値に置き換える
npm run dev                        # http://localhost:3000
```

**Cloud Functions**

```bash
cd functions
npm ci
npm run build
npm run serve                      # Firebase エミュレーターで起動
```

Claude API キーは Secret Manager で管理する。

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

**Firestore のルール・インデックス**

```bash
firebase deploy --only firestore
```

環境変数の一覧は [.env.example](.env.example) を参照。

---

## コスト（月額・試算）

| 項目 | 費用 |
|---|---|
| Claude API（Haiku 採点 + Sonnet 要約） | ~$3〜5 |
| Firebase（Firestore・App Hosting・Functions） | 無料枠内 |
| **合計** | **~$3〜5** |

※ 2段階モデル構成 + 一括採点への移行後の試算値。

コストは 2 系統で監視している（[docs/monitoring.md](docs/monitoring.md)）。

- **Firebase（GCP）**: 月 ¥500 の予算アラート。¥100 / ¥250 / ¥500 の各時点でメール通知
- **Claude API（Anthropic）**: 月間利用上限 $5、$4 到達時にメール通知

---

## ライセンス

[MIT License](LICENSE) © 2026 Shunnie816

本リポジトリは個人利用を目的に作られたものです。取得元の各記事の著作権はそれぞれの発行元に帰属します。
