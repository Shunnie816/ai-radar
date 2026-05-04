# ai-radar 技術レクチャー

## 目次

1. [RSSフィードの仕組み](#1-rssフィードの仕組み)
2. [n8nとは何か](#2-n8nとは何か)
3. [n8nのワークフロー設計](#3-n8nのワークフロー設計)
4. [Firebase Firestoreの役割](#4-firebase-firestoreの役割)
5. [Claude APIの使い方](#5-claude-apiの使い方)
6. [全体の情報の流れ](#6-全体の情報の流れ)

---

## 1. RSSフィードの仕組み

### RSSとは

RSS (Really Simple Syndication) は、Webサイトの更新情報を配信するための**標準フォーマット（XML）**。
ほぼすべてのニュースサイト・ブログが提供している。

### データの構造

```xml
<!-- RSS の実際のレスポンス例 -->
<rss version="2.0">
  <channel>
    <title>Anthropic News</title>
    <link>https://www.anthropic.com/news</link>
    <item>
      <title>Claude 4 is now available</title>
      <link>https://www.anthropic.com/news/claude-4</link>
      <pubDate>Mon, 04 May 2026 09:00:00 GMT</pubDate>
      <description>Today we're releasing Claude 4...</description>
    </item>
    <item>...</item>
  </channel>
</rss>
```

### このプロジェクトでの使い方

```
RSSフィードURL → HTTP GETリクエスト → XMLレスポンス → パース → 記事リスト取得
```

n8nの **RSS Read** ノードが自動的にXMLをパースしてくれるため、
自分でXMLを処理するコードは書かなくていい。

### 主なRSSフィードURL（参考）

| 媒体 | RSS URL |
|---|---|
| OpenAI Blog | `https://openai.com/blog/rss.xml` |
| Anthropic News | `https://www.anthropic.com/rss.xml` |
| Hacker News (top) | `https://news.ycombinator.com/rss` |
| ITmedia AI | `https://rss.itmedia.co.jp/rss/2.0/aiplus.xml` |
| Zenn (AIタグ) | `https://zenn.dev/feed?topicname=ai` |

> ※ URLは変更される場合があるため、実装時に確認すること

---

## 2. n8nとは何か

### 概要

n8nは**ノーコード/ローコードのワークフロー自動化ツール**。
Zapier / Make (旧Integromat) の self-hosted 版に相当する。

```
「AというイベントがあったらBを実行し、その結果をCに渡す」
という処理をGUIで組み立てられる。
```

### なぜn8nを使うか

- **スケジュール実行**が簡単に組める（cron）
- HTTP・API呼び出しが標準搭載
- エラー通知・リトライが設定可能
- コードを書かずにワークフローを構成できる
- self-hostedなので**APIキーが外部サービスに渡らない**

### n8nの概念

```
Workflow（ワークフロー）
  └─ Node（ノード）をつないで処理の流れを作る
       │
       ├─ Trigger Node  : 処理の起点（cron, Webhook, etc）
       ├─ Action Node   : 何かをする（HTTPリクエスト, DBへの書き込み, etc）
       └─ Logic Node    : 条件分岐・ループ（IF, Switch, Loop, etc）
```

### 主なノードタイプ

| ノード | 役割 | このプロジェクトでの用途 |
|---|---|---|
| `Schedule Trigger` | cronで定期実行 | 毎日6時に起動 |
| `RSS Read` | RSSフィード取得（1URLずつ） | Loop内で各メディアを順番に取得 |
| `HTTP Request` | APIリクエスト | Claude API呼び出し |
| `Google Cloud Firestore` | FirestoreのCRUD（標準搭載） | 記事・要約の読み書き |
| `Code` | JavaScriptを書ける | RSSソース定義・重複チェック |
| `IF` | 条件分岐 | 重複チェック後の分岐 |
| `Loop Over Items` | 配列をループ | RSSソース巡回・記事処理 |
| `Set` | データを整形・セット | Firestoreに渡すデータ整形 |

---

## 3. n8nのワークフロー設計

### ワークフロー全体像

> **重要**: n8nの `RSS Read` ノードは **1URLずつしか処理できない**。
> 複数ソースを扱うには `Code` ノードでURL配列を定義し、`Loop Over Items` で1件ずつ処理するのが公式推奨パターン。

```
[Schedule Trigger: 毎日06:00]
         │
         ▼
[Code: RSSソースのURL配列を定義]
         │
         ▼
[Loop Over Items: URLを1件ずつ取り出す]
         │
         ▼
[RSS Read: {{ $json.url }} で動的に取得]  ← ループで8ソース全て処理
         │
         ▼  ※ ループ完了後、全記事が蓄積される
[Code: 重複URLチェック]
※ Google Cloud Firestore ノードで既存URLを取得して照合
         │
    新規記事のみ
         │
         ▼
[Loop Over Items: 新規記事を1件ずつ]
         │
         ▼
[HTTP Request: Claude API]
※ 記事を要約・タグ付け・重要度判定
         │
         ▼
[Google Cloud Firestore: articles に保存]
         │
  ループ終了（全記事処理完了）
         │
         ▼
[HTTP Request: Claude API]
※ 当日全記事 → 日次要約生成
         │
         ▼
[Google Cloud Firestore: daily_summaries に保存]
```

### Codeノード：RSSソース定義の書き方

```javascript
// n8n Code ノードに記述する
return [
  { json: { url: 'https://openai.com/blog/rss.xml',     source: 'OpenAI Blog' } },
  { json: { url: 'https://www.anthropic.com/rss.xml',    source: 'Anthropic News' } },
  { json: { url: 'https://news.ycombinator.com/rss',     source: 'Hacker News' } },
  // ... 8ソース分
];
```

### 重複チェックの仕組み

```
1. Google Cloud Firestore ノードで過去7日分のURLを取得
2. 今日取得したRSS記事のURLと照合（Code ノードでJavaScript処理）
3. 既にあるURLは除外
4. 新規記事のみ次のステップへ
```

### n8n の Firestore 連携（標準搭載ノード）

n8nには **Google Cloud Firestore ノードが標準搭載**されている。
HTTP RequestでFirestore REST APIを手書きする必要はない。

```
設定手順:
1. n8n Credentials に Google Service Account JSON を登録
2. "Google Cloud Firestore" ノードを追加
3. Operation: Create Document / Get Document / Query を選択
4. Collection・Document IDを指定するだけ
```

### Claude APIの呼び出し方（n8n HTTP Request）

```json
POST https://api.anthropic.com/v1/messages

Headers:
  x-api-key: {{ $credentials.anthropicApiKey }}
  anthropic-version: 2023-06-01
  content-type: application/json

Body:
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": "あなたはAI業界の専門家です。...",
  "messages": [
    {
      "role": "user",
      "content": "以下の記事を要約してください:\nタイトル: {{ $json.title }}\n内容: {{ $json.description }}"
    }
  ]
}
```

---

## 4. Firebase Firestoreの役割

### Firestoreとは

GoogleのNoSQL クラウドデータベース。
**ドキュメント（JSONに近い形）をコレクション単位で管理する。**

```
Firestore
├── articles/           ← コレクション
│   ├── doc-abc123      ← ドキュメント（記事1件）
│   ├── doc-def456
│   └── ...
└── daily_summaries/    ← コレクション
    ├── 2026-05-04      ← ドキュメントID = 日付
    └── ...
```

### RDBとの比較

| 概念 | Firestore | RDB |
|---|---|---|
| データの入れ物 | コレクション | テーブル |
| 1件のデータ | ドキュメント | レコード/行 |
| スキーマ | 不要（柔軟） | 必要（固定） |
| 結合 | 基本しない | JOINで行う |

### このプロジェクトでの読み書きパターン

```
書き込み（n8n側）:
  記事処理完了 → Firestore Write → articles/{id}

読み込み（Next.js側）:
  ページ表示   → Firestore Read  → articles（日付フィルタ）
  ページ表示   → Firestore Read  → daily_summaries/{date}
```

---

## 5. Claude APIの使い方

### 基本構造

```
リクエスト:
  system   : AIの役割・出力形式の指示（毎回同じ → キャッシュ可能）
  messages : 今回処理する記事の内容（毎回変わる）

レスポンス:
  content[0].text : AIが生成したテキスト
```

### Prompt Cachingでコスト削減

システムプロンプト（要約の形式指示）は毎回同じ内容。
Anthropicの **Prompt Caching** を使うと、同じsystemプロンプトを2回目以降はキャッシュから読むためコストが90%削減される。

```json
"system": [
  {
    "type": "text",
    "text": "あなたはAI業界の専門家です。記事を以下の形式で要約してください...",
    "cache_control": { "type": "ephemeral" }  ← これがキャッシュ指定
  }
]
```

### レスポンスのJSON化

Claude APIのレスポンスは自由テキスト。
構造化データが欲しい場合は、プロンプトでJSON形式を指定する。

```
プロンプト:
  必ず以下のJSON形式で返してください：
  {
    "summary": "要約文",
    "importance": "high|medium|low",
    "tags": ["タグ1", "タグ2"]
  }
  
  JSON以外のテキストは含めないでください。
```

---

## 6. 全体の情報の流れ

```
【取得フェーズ】
n8n Code ノード（URL配列定義）
  → Loop Over Items（8ソースを順番に処理）
    → RSS Read ノード（1ソースずつXML取得・パース）
  → 全ソースの記事が蓄積される

【フィルタフェーズ】
取得した記事一覧
  → Google Cloud Firestore ノードで既存URLを照合
  → 新規記事のみ通過

【AI処理フェーズ】
新規記事を Loop Over Items で1件ずつ
  → HTTP Request → Claude API（記事要約・タグ・重要度）
  → JSON形式でレスポンス受信

【保存フェーズ A】
要約結果
  → Google Cloud Firestore ノード → articles コレクション に保存

【日次集約フェーズ】
当日の全新規記事タイトル＋要約
  → HTTP Request → Claude API（日次トレンド要約）
  → Google Cloud Firestore ノード → daily_summaries コレクション に保存

【表示フェーズ】
ユーザーがNext.jsにアクセス（Firebase App Hosting でホスト）
  → Server Components が Firestore から日次要約・記事一覧を取得
  → キャッシュ戦略（revalidate）で不要な再フェッチを防ぐ
  → 画面に表示
```

---

## よくある疑問

**Q. n8nはどこで動かすの？**
A. ローカルPCのDockerで動かす。`docker-compose up` で起動、`localhost:5678` でGUI操作できる。
常時稼働させたい場合はVPS（さくらVPS / Render / Railway等）に移す。

**Q. n8nのワークフローはどこに保存されるの？**
A. Dockerボリューム (`n8n_data`) に自動保存される。エクスポートするとJSON形式でバックアップできる。

**Q. Firestoreの無料枠は足りる？**
A. 1日30記事 × 30日 = 900ドキュメント/月。無料枠は読み取り50,000回/日・書き込み20,000回/日なので全く問題ない。

**Q. APIキーはどこで管理するの？**
A. n8nの「Credentials」機能で管理する。n8nのGUI上で設定し、ワークフロー内から参照する形。コードには直接書かない。

**Q. n8nからFirestoreへの書き込みはHTTP Requestで行うの？**
A. いいえ。n8nには **Google Cloud Firestore ノードが標準搭載**されている。Credentialsにサービスアカウントのメールとキーを設定すれば、ノードのGUI操作だけで読み書きできる。HTTP RequestでFirestore REST APIを手書きする必要はない。

**Q. RSSソースを増やしたい場合は？**
A. Code ノードの配列に1行追加するだけ。ワークフローの構造を変える必要はない。
