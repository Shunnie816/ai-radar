# ai-radar システム設計

## 技術スタック

| レイヤー     | 技術                                             |
| ------------ | ------------------------------------------------ |
| ワークフロー | Cloud Functions (Firebase) — Node.js 22          |
| スケジュール | Cloud Scheduler（Cloud Functions に内包）        |
| AI           | Claude API (Anthropic) ※OpenAI切り替え可能な設計 |
| DB           | Firebase Firestore                               |
| Web UI       | Next.js 16 (App Router)                          |
| ホスティング | Firebase App Hosting                             |
| ドメイン     | 自己所有ドメインのサブドメイン                   |
| データ取得   | RSS                                              |

---

## システム構成

```
[RSSフィード群]
      ↓ (毎日 06:00 JST / Cloud Scheduler)
[Cloud Functions: dailyFeed]
  ├─ 1. RSS Fetch (並列・全ソース同時)
  ├─ 2. 重複除去 (URLで既存チェック)
  ├─ 3. 記事単体要約 (Claude API・逐次 1.5s間隔)
  ├─ 4. Firestore保存 (articles)
  ├─ 5. 日次要約生成 (Claude API)
  └─ 6. Firestore保存 (daily_summaries)
      ↓
[Firebase Firestore]
      ↓
[Next.js Web UI / Firebase App Hosting]
```

---

## Cloud Functions 設計

### エントリポイント

`functions/src/index.ts` — `dailyFeed` 関数

### スケジュール

```typescript
onSchedule({
  schedule: "0 21 * * *",  // 06:00 JST (21:00 UTC)
  timeZone: "UTC",
  timeoutSeconds: 540,
  memory: "512MiB",
  secrets: ["ANTHROPIC_API_KEY"],
})
```

### ワークフローステップ

```
dailyFeed()
  └→ fetchRssArticles()        // 7ソースを Promise.allSettled で並列取得
       └→ filterNewArticles()  // Firestore の articles.url と照合
            └→ summarizeArticlesSequentially()  // 最大50件を 1.5s間隔で逐次処理
                 ├─ summarizeArticle()           // Claude API → extractJson() → Firestore
                 └→ saveArticles()              // バッチ書き込み
                      └→ generateDailySummary() // Claude API → daily_summaries に保存
```

### レート制限対策

Claude API の制限（50 req/min）に対し、記事要約を 1.5秒間隔の逐次処理で実行。
50件処理しても最大 75秒（タイムアウト 540秒に余裕あり）。

### JSON パース

Claude のレスポンスがマークダウンコードブロックを含む場合に備え、
`extractJson()` で正規表現 `/\{[\s\S]*\}/` により JSON オブジェクト部分のみを抽出してからパース。

### RSSソース

```typescript
const RSS_SOURCES = [
  { url: "https://openai.com/news/rss.xml",                      source: "OpenAI Blog" },
  { url: "https://deepmind.google/blog/rss.xml",                 source: "Google DeepMind" },
  { url: "https://news.ycombinator.com/rss",                     source: "Hacker News" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/",  source: "AWS ML Blog" },
  { url: "https://cloudblog.withgoogle.com/rss",                 source: "Google Cloud Blog" },
  { url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",         source: "ITmedia AI" },
  { url: "https://zenn.dev/topics/ai/feed",                      source: "Zenn AI" },
];
```

### Claude API プロンプト方針

**記事単体要約**

```
以下の記事を日本語で要約してください。

出力形式（JSONのみ）：
{
  "summary": "何が起きたか・なぜ重要か・誰に影響があるかを2〜4文で",
  "importance": "high | medium | low",
  "tags": ["タグ1", "タグ2"]
}
```

**日次要約**

```
今日収集したAI関連記事から以下を抽出してください：
{
  "summary": "今日のトレンドの方向性（200字以内）",
  "keyTopics": ["トピック1", "トピック2", "トピック3"]
}
```

---

## Firestore スキーマ

### `articles` コレクション

```typescript
{
  id: string,              // auto-generated
  title: string,
  source: string,          // "OpenAI Blog" | "Anthropic News" | ...
  url: string,             // unique, 重複チェックに使用
  publishedAt: Timestamp,
  rawContent: string,      // RSSから取得した概要文
  summary: string,         // AI要約（日本語）
  importance: "high" | "medium" | "low",
  tags: string[],
  createdAt: Timestamp
}
```

### `daily_summaries` コレクション

```typescript
{
  id: string,              // YYYY-MM-DD 形式
  date: string,            // "2026-05-04"
  summary: string,         // 日次トレンド要約（日本語）
  keyTopics: string[],     // ["エージェント", "マルチモーダル", ...]
  articleCount: number,
  articleIds: string[],
  createdAt: Timestamp
}
```

---

## Next.js アプリ設計

### ディレクトリ構成

```
apps/web/  # Next.js 16 (App Router)
├── app/
│   ├── page.tsx                    # / ダッシュボード（最新日次要約）
│   ├── daily/
│   │   └── [date]/
│   │       └── page.tsx            # /daily/2026-05-04
│   ├── articles/
│   │   ├── page.tsx                # /articles 記事一覧
│   │   └── [id]/
│   │       └── page.tsx            # /articles/:id
│   └── api/
│       ├── summaries/
│       │   ├── route.ts            # GET /api/summaries
│       │   └── [date]/
│       │       └── route.ts        # GET /api/summaries/:date
│       └── articles/
│           ├── route.ts            # GET /api/articles
│           └── [id]/
│               └── route.ts        # GET /api/articles/:id
├── components/
│   ├── DailySummaryCard.tsx
│   ├── ArticleCard.tsx
│   └── TagBadge.tsx
└── lib/
    ├── firebase.ts                 # Firestore クライアント初期化
    └── types.ts                   # 共通型定義
```

### データフェッチとキャッシュ戦略

| ページ | キャッシュ戦略 | 理由 |
|---|---|---|
| `/` | `revalidate: 3600`（1時間） | 当日データが更新される可能性がある |
| `/daily/[date]` | `revalidate: 86400`（24時間） | 過去日のデータは変化しない |
| `/articles` | `revalidate: 3600` | フィルタ結果も日次更新で十分 |
| `/articles/[id]` | `force-cache` | 記事の内容は保存後に変化しない |

---

## デプロイ・公開構成

```
GitHub push (main)
  ├─ Firebase App Hosting → Next.js ビルド → Cloud Run にデプロイ
  └─ firebase deploy --only functions → Cloud Functions 更新
```

### Firebase App Hosting

- GitHubリポジトリ接続で `main` push → 自動デプロイ
- Cloud Run ベースで自動スケール
- `apps/web/apphosting.yaml` で設定

### Cloud Functions

- `functions/` ディレクトリを Firebase CLI でデプロイ
- `ANTHROPIC_API_KEY` は Secret Manager で管理
- Firestore Admin SDK はデフォルト認証（サービスアカウントキー不要）

### カスタムドメイン

```
Firebase Console → App Hosting → カスタムドメイン追加
  → DNS に CNAME レコード追加
  → SSL 証明書は自動発行
```

### Firestoreセキュリティルール

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{id} {
      allow read: if true;   // 誰でも読める（外部公開）
      allow write: if false; // 書き込みは拒否（Cloud Functions は Admin SDK で書く）
    }
    match /daily_summaries/{id} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## コスト試算（月次）

| 項目                  | 試算                                                        |
| --------------------- | ----------------------------------------------------------- |
| Claude API (記事要約) | 約30記事/日 × 1,000トークン × 30日 = 900Kトークン ≒ $0.5〜1 |
| Claude API (日次要約) | 30日分 × 2,000トークン = 60Kトークン ≒ $0.1以下             |
| Firestore             | 無料枠内（読み取り50K/日、書き込み20K/日）                  |
| Cloud Functions       | 月30回実行 → 無料枠内（200万回/月まで無料）                 |
| Cloud Scheduler       | 1ジョブ → 無料枠内（3ジョブ/月まで無料）                   |
| Firebase App Hosting  | 個人利用規模 → ほぼ無料                                     |
| **合計**              | **月$1〜2程度**                                             |

---

## 懸念点と対策

| 懸念               | 対策                                    |
| ------------------ | --------------------------------------- |
| APIコスト増大      | 1日最大50記事に制限、重要度低はスキップ |
| Firestore肥大化    | 90日以上の記事は定期削除 or アーカイブ  |
| RSS取得失敗        | Promise.allSettled で部分失敗を許容     |
| 要約品質のばらつき | プロンプトの定期見直し                  |
| Claude レート制限  | 逐次処理 + 1.5s インターバルで回避      |
| 外部公開時の書き込み悪用 | Firestore ルールで書き込みを全拒否（Cloud Functions は Admin SDK 経由） |
