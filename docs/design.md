# ai-radar システム設計

## 技術スタック

| レイヤー     | 技術                                             |
| ------------ | ------------------------------------------------ |
| ワークフロー | n8n (self-hosted, Docker)                        |
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
      ↓ (毎日 06:00 JST)
[n8n Workflow]
  ├─ 1. RSS Fetch (並列)
  ├─ 2. 重複除去 (URLで既存チェック)
  ├─ 3. 記事単体要約 (Claude API)
  ├─ 4. Firestore保存 (articles)
  ├─ 5. 日次要約生成 (Claude API)
  └─ 6. Firestore保存 (daily_summaries)
      ↓
[Firebase Firestore]
      ↓
[Next.js Web UI]
```

---

## n8n ワークフロー設計

### スケジュール

- 毎日 06:00 JST (21:00 UTC)
- 前日分の記事をまとめて処理

### ワークフローステップ

n8nの `RSS Read` ノードは1URLずつしか処理できないため、
`Code` ノードでURL配列を定義し `Loop Over Items` で順番に処理する。

```
Cron Trigger
  └→ [Code] RSSソースのURL配列を定義
       └→ [Loop Over Items] URLを1件ずつ取り出す
            └→ [RSS Read] {{ $json.url }} で動的にRSS取得
                 └→ [Code: 重複チェック] FirestoreのURLと照合・新規のみ通過
                      └→ [Loop Over Items] 新規記事を1件ずつ処理
                           └→ [HTTP Request] Claude API（記事要約）
                                └→ [Google Cloud Firestore] articles に保存
                                     └→ [HTTP Request] Claude API（日次要約）
                                          └→ [Google Cloud Firestore] daily_summaries に保存
```

```javascript
// Code ノードの内容（RSSソース定義）
return [
  { json: { url: 'https://openai.com/news/rss.xml',          source: 'OpenAI Blog' } },
  { json: { url: 'https://deepmind.google/blog/rss.xml',     source: 'Google DeepMind' } },
  { json: { url: 'https://news.ycombinator.com/rss',         source: 'Hacker News' } },
  { json: { url: 'https://aws.amazon.com/blogs/machine-learning/feed/', source: 'AWS ML Blog' } },
  { json: { url: 'https://cloudblog.withgoogle.com/rss',     source: 'Google Cloud Blog' } },
  { json: { url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml', source: 'ITmedia AI' } },
  { json: { url: 'https://zenn.dev/topics/ai/feed',           source: 'Zenn AI' } },
];
```

### Claude API プロンプト方針

**記事単体要約（system prompt をキャッシュ）**

```
以下の記事を日本語で要約してください。

出力形式：
- 何が起きたか（1〜2文）
- なぜ重要か（1〜2文）
- 誰に影響があるか（1文）
- 重要度: high / medium / low
- タグ: ["LLM", "OpenAI"] など
```

**日次要約**

```
今日収集した記事から以下を抽出してください：
- 共通テーマ（3〜5個）
- トレンドの方向性（200字以内）
- 特に重要なトピック（上位3件）
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

### 画面設計

| ページ           | 内容                                             |
| ---------------- | ------------------------------------------------ |
| `/`              | 最新の日次要約 + 重要記事3件 + 過去7日分のリンク |
| `/daily/[date]`  | その日のトレンド要約 + 記事一覧                  |
| `/articles`      | 記事一覧（ソース・タグ・重要度でフィルタ）       |
| `/articles/[id]` | 記事詳細（原文リンク + AI要約）                  |

### データフェッチとキャッシュ戦略

日次バッチ更新のため、毎リクエストごとの再フェッチは不要。Server Components で以下のキャッシュ戦略を使う。

| ページ | キャッシュ戦略 | 理由 |
|---|---|---|
| `/` | `revalidate: 3600`（1時間） | 当日データが更新される可能性がある |
| `/daily/[date]` | `revalidate: 86400`（24時間） | 過去日のデータは変化しない |
| `/articles` | `revalidate: 3600` | フィルタ結果も日次更新で十分 |
| `/articles/[id]` | `force-cache` | 記事の内容は保存後に変化しない |

```typescript
// 例: /daily/[date] の場合
export const revalidate = 86400;

export default async function DailyPage({ params }: { params: { date: string } }) {
  const summary = await getDailySummary(params.date); // Firestoreから取得
  return <DailySummaryView summary={summary} />;
}
```

---

## Docker構成（n8n）

```yaml
# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=http://localhost:5678
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n/workflows:/workflows

volumes:
  n8n_data:
```

---

## 環境変数

```env
# .env.local (Next.js)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# n8n環境変数（n8nのCredentials管理）
ANTHROPIC_API_KEY=
N8N_PASSWORD=
```

---

## コスト試算（月次）

| 項目                  | 試算                                                        |
| --------------------- | ----------------------------------------------------------- |
| Claude API (記事要約) | 約30記事/日 × 1,000トークン × 30日 = 900Kトークン ≒ $0.5〜1 |
| Claude API (日次要約) | 30日分 × 2,000トークン = 60Kトークン ≒ $0.1以下             |
| Firestore             | 無料枠内（読み取り50K/日、書き込み20K/日）                  |
| n8n self-hosted       | サーバー代のみ（ローカルなら無料）                          |
| **合計**              | **月$1〜2程度**                                             |

---

## 実装順序（MVP）

1. Firebase プロジェクト作成・Firestoreスキーマ設定
2. n8n Docker起動・RSS Fetchワークフロー作成
3. Claude API連携・要約ワークフロー完成
4. Next.jsアプリ雛形・Firestore読み取り
5. UI実装（ダッシュボード → 記事一覧）
6. 動作確認・調整

---

## デプロイ・公開構成

### Firebase App Hosting を選ぶ理由

- 他アプリと同じ環境に統一できる
- FirestoreとFirebaseプロジェクトが同一なため設定がシンプル
- Server ComponentsからAdmin SDKをデフォルト認証で使えるため、秘密鍵管理不要
- GitHubリポジトリ接続で `main` push → 自動デプロイ
- Cloud Run ベースで自動スケール

### apphosting.yaml（apps/web/ に配置）

`NEXT_PUBLIC_` 変数はビルド時にバンドルに埋め込まれるため `availability` に `BUILD` と `RUNTIME` の両方を指定する必要がある。

```yaml
runConfig:
  minInstances: 0    # 個人利用: コールドスタートを許容してコスト削減
  maxInstances: 10
  concurrency: 100
  cpu: 1
  memoryMiB: 512

env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: your-api-key
    availability:
      - BUILD
      - RUNTIME

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: your-project.firebaseapp.com
    availability:
      - BUILD
      - RUNTIME

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: ai-radar-xxxxx
    availability:
      - BUILD
      - RUNTIME

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: your-app-id
    availability:
      - BUILD
      - RUNTIME
```

### デプロイフロー

```
GitHub push (main)
  → Firebase App Hosting が自動検知
  → Next.js ビルド（SSR対応）
  → Cloud Run にデプロイ
  → サブドメインで公開
```

### カスタムドメイン設定

```
Firebase Console
  → App Hosting → カスタムドメイン追加
  → ai-radar.yourdomain.com を入力
  → DNSにCNAMEレコードを追加（Firebaseが指示する値）
  → SSL証明書は自動発行
```

### Firestoreセキュリティルール（外部公開用）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{id} {
      allow read: if true;   // 誰でも読める（外部公開）
      allow write: if false; // 書き込みは拒否（n8nはAdmin SDKで書く）
    }
    match /daily_summaries/{id} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 環境変数の管理方針

| 変数 | 管理場所 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | `apphosting.yaml` の `env:` | `availability: [BUILD, RUNTIME]` 必須 |
| `ANTHROPIC_API_KEY` | n8n Credentials | n8n GUI上で管理、コードに直接書かない |
| `N8N_PASSWORD` | Docker `.env` ファイル | `.gitignore` で除外 |

> Firebase App Hosting のサーバー側（Server Components / Route Handlers）では Admin SDK のデフォルト認証が自動適用されるため `GOOGLE_APPLICATION_CREDENTIALS` の設定不要。

---

## 懸念点と対策

| 懸念               | 対策                                    |
| ------------------ | --------------------------------------- |
| APIコスト増大      | 1日最大50記事に制限、重要度低はスキップ |
| Firestore肥大化    | 90日以上の記事は定期削除 or アーカイブ  |
| RSS取得失敗        | n8nのエラーハンドリング + リトライ設定  |
| 要約品質のばらつき | プロンプトの定期見直し                  |
| 外部公開時の書き込み悪用 | Firestoreルールで書き込みを全拒否（n8nはAdmin SDK経由） |
