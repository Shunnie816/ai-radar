# ai-radar

AI関連情報を毎日自動収集・要約し、トレンドを把握するための個人向けシステム。

**URL**: https://ai-radar.shunniehub.com/

---

## 機能

- **自動収集**: 15のRSSソースからAI・テック・セキュリティ関連記事を毎日 06:00 JST に自動取得
- **2段階AI処理**: Haiku が重要度をスコアリング（4軸10点満点）→ high / medium のみ Sonnet が日本語要約（重要度・タグ付き）
- **日次サマリー**: その日のトレンドと主要トピックを high 記事から自動生成
- **閲覧 UI**: ダッシュボード・日次サマリー・記事一覧（キーワード検索・重要度/ソースフィルタ）・記事詳細
- **アカウント機能**: Google ログイン・記事のお気に入り・コメント（投稿/編集/削除）・プロフィール（表示名・アイコン設定、自分の活動一覧）
- **運用監視**: dailyFeed の失敗を Cloud Monitoring ログベースアラートでメール通知（[docs/monitoring.md](docs/monitoring.md)）

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

## コスト（月額・試算）

| 項目 | 費用 |
|---|---|
| Claude API（Haiku 採点 + Sonnet 要約） | ~$3〜5 |
| Firebase（Firestore・App Hosting・Functions） | 無料枠内 |
| **合計** | **~$3〜5** |

※ 2段階モデル構成（#46）+ 一括採点（#52）後の試算。実測値の確認は #52 で継続中。
