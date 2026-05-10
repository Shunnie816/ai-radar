# ai-radar

AI関連情報を毎日自動収集・要約し、トレンドを把握するための個人向けシステム。

**URL**: https://ai-radar.shunniehub.com/

---

## 機能

- **自動収集**: 7つのRSSソースからAI関連記事を毎日 06:00 JST に自動取得
- **AI要約**: Claude API による日本語要約（重要度・タグ付き）
- **日次サマリー**: その日のトレンドと主要トピックを自動生成
- **閲覧 UI**: ダッシュボード・日次サマリー・記事一覧・記事詳細

### RSSソース

| ソース | 言語 |
|---|---|
| OpenAI Blog | 英語 |
| Google DeepMind Blog | 英語 |
| Hacker News | 英語 |
| AWS Machine Learning Blog | 英語 |
| Google Cloud Blog | 英語 |
| ITmedia AI+ | 日本語 |
| Zenn AI タグ | 日本語 |

---

## システム構成

```
Cloud Scheduler (毎日 06:00 JST)
  └── Cloud Functions (dailyFeed)
        ├── RSS 取得
        ├── 重複チェック（Firestore）
        ├── Claude API で記事要約
        ├── Firestore に保存（articles）
        └── Claude API で日次サマリー生成・保存（daily_summaries）

Firestore ─── Next.js (Firebase App Hosting) ─── ブラウザ
```

---

## ローカル開発

### 前提

- Node.js 22+
- Firebase CLI (`npm install -g firebase-tools`)
- `firebase login` 済み

### Web UI

```bash
cd apps/web
npm install
npm run dev
# http://localhost:3000
```

### Cloud Functions

```bash
cd functions
npm install
npm run build
```

デプロイ:

```bash
firebase deploy --only functions
```

---

## 環境変数

### Web UI（`apps/web/.env.local`）

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Cloud Functions

`ANTHROPIC_API_KEY` は Firebase Secret Manager で管理:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

---

## コスト（月額）

| 項目 | 費用 |
|---|---|
| Claude API | ~$1〜2 |
| Firebase（Firestore・App Hosting・Functions） | 無料枠内 |
| **合計** | **~$1〜2** |
