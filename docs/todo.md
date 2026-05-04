# ai-radar 作業TODO

最終更新: 2026-05-04

## 凡例

- `[ ]` 未着手
- `[→]` 進行中
- `[x]` 完了
- `[-]` スキップ / 対象外

---

## Phase 0: 設計・準備 ✅

- [x] 要件定義（docs/requirements.md）
- [x] システム設計（docs/design.md）
- [x] 技術レクチャー（docs/lecture.md）
- [x] 作業TODOリスト作成（本ファイル）

---

## Phase 1: Firebase セットアップ

- [ ] **1-1.** Firebaseプロジェクト作成
  - Firebase Console でプロジェクト新規作成
  - プロジェクト名: `ai-radar`
- [ ] **1-2.** Firestoreデータベース作成
  - モード: `production mode`（後でルール設定）
  - リージョン: `asia-northeast1`（東京）
- [ ] **1-3.** Firestoreセキュリティルール設定
  - 読み取り: 公開（外部公開のため全ユーザー許可）
  - 書き込み: 全拒否（n8nはAdmin SDKで書く）
- [ ] **1-4.** Firestoreインデックス設定
  - `articles`: `publishedAt DESC` + `source`
  - `articles`: `publishedAt DESC`（日付フィルタ用）
- [ ] **1-5.** Firebase Admin SDK用サービスアカウント作成
  - Google Cloud Console でサービスアカウント作成
  - ロールは `Cloud Datastore ユーザー` のみ付与（Firebase Admin は不可）
  - JSON秘密鍵をダウンロード → n8n Credentials に登録（ファイルはGit管理外）
- [ ] **1-6.** Next.js用Firebaseアプリ設定
  - Webアプリを追加 → `firebaseConfig` 取得
- [ ] **1-7.** Firebase App Hosting 有効化
  - Firebase Console → App Hosting → 新しいバックエンド作成
  - GitHubリポジトリ接続（後でも可）

---

## Phase 2: n8n セットアップ

- [ ] **2-1.** docker-compose.yml 作成
- [ ] **2-2.** n8n Docker起動確認
  - `docker-compose up -d`
  - `localhost:5678` でGUIアクセス確認
- [ ] **2-3.** n8n Credentials 登録
  - Anthropic API Key
  - Firebase Admin SDK（サービスアカウントJSON）
- [ ] **2-4.** RSSフィードURLの動作確認
  - 各ソースのRSS URLが有効か確認
  - 実際に記事が取得できるか検証

---

## Phase 3: n8n ワークフロー実装

- [ ] **3-1.** Schedule Trigger設定
  - 毎日 06:00 JST (21:00 UTC)
- [ ] **3-2.** RSS Fetchノード作成（各ソース）
  - OpenAI Blog
  - Anthropic News
  - Google DeepMind Blog
  - Hacker News
  - AWS ML Blog
  - Google Cloud Blog
  - ITmedia AI+
  - Zenn (AIタグ)
- [ ] **3-3.** Merge ノードで記事を結合
- [ ] **3-4.** 重複チェック実装
  - Firestoreから過去URLを取得
  - Code ノードで照合・除外
- [ ] **3-5.** 記事単体要約ワークフロー
  - Loop Over Items
  - HTTP Request → Claude API
  - レスポンスパース（JSON抽出）
- [ ] **3-6.** articles コレクションへの保存
- [ ] **3-7.** 日次要約ワークフロー
  - 当日記事を集約
  - HTTP Request → Claude API（日次要約プロンプト）
- [ ] **3-8.** daily_summaries コレクションへの保存
- [ ] **3-9.** エラーハンドリング設定
  - APIエラー時のリトライ
  - エラー通知（メール or Slack）

---

## Phase 4: 動作確認（n8n）

- [ ] **4-1.** ワークフローの手動実行テスト
- [ ] **4-2.** Firestoreにデータが正しく保存されているか確認
- [ ] **4-3.** 日次要約が生成されるか確認
- [ ] **4-4.** 重複チェックが機能するか確認（2回目の実行で重複なし）
- [ ] **4-5.** Schedule Trigger による自動実行確認

---

## Phase 5: Next.js アプリ構築

- [ ] **5-1.** Next.js プロジェクト初期化
  ```
  cd apps && npx create-next-app@16 web
  ```
  - TypeScript: Yes
  - Tailwind CSS: Yes
  - App Router: Yes
- [ ] **5-2.** Firebase SDK インストール・設定
  - `npm install firebase`
  - `lib/firebase.ts` 作成
- [ ] **5-3.** 共通型定義 `lib/types.ts` 作成
- [ ] **5-4.** API Routes 実装
  - `GET /api/summaries` - 日次要約一覧
  - `GET /api/summaries/[date]` - 特定日の要約
  - `GET /api/articles` - 記事一覧（フィルタ対応）
  - `GET /api/articles/[id]` - 記事詳細
- [ ] **5-5.** ダッシュボードページ実装 (`/`)
  - 最新の日次要約
  - 重要記事3件
  - 過去7日分へのリンク
- [ ] **5-6.** 日次サマリーページ実装 (`/daily/[date]`)
  - その日のトレンド要約
  - 記事一覧
- [ ] **5-7.** 記事一覧ページ実装 (`/articles`)
  - ソース・タグ・重要度フィルタ
- [ ] **5-8.** 記事詳細ページ実装 (`/articles/[id]`)
  - 原文リンク + AI要約
- [ ] **5-9.** 共通コンポーネント作成
  - `DailySummaryCard`
  - `ArticleCard`
  - `TagBadge`

---

## Phase 6: 統合テスト・調整

- [ ] **6-1.** n8n → Firestore → Next.js の全体フロー確認
- [ ] **6-2.** 要約プロンプトの品質確認・調整
- [ ] **6-3.** UIの表示確認・微調整
- [ ] **6-4.** エラーケースの確認

---

## Phase 7: ローカル運用・検証

- [ ] **7-1.** n8n の自動実行で数日間データ蓄積
- [ ] **7-2.** 実際に毎日利用して使い勝手を確認
- [ ] **7-3.** 不要なソース・追加したいソースの調整

---

## Phase 8: 外部公開

### 8-1. GitHubリポジトリ準備
- [ ] GitHubリポジトリ作成・初回push
- [ ] `.gitignore` で秘密情報を除外
  - `.env.local`
  - `*.json`（サービスアカウントキー）
  - `n8n/` 内の認証情報ファイル

### 8-2. Firebase App Hosting デプロイ
- [ ] `apps/web/apphosting.yaml` 作成
- [ ] Firebase App Hosting とGitHubリポジトリを接続
- [ ] 環境変数を Firebase App Hosting コンソールに設定
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] main ブランチ push → 自動デプロイ確認

### 8-3. カスタムドメイン設定
- [ ] Firebase Console → App Hosting → カスタムドメイン追加
- [ ] サブドメイン入力（例: `ai-radar.yourdomain.com`）
- [ ] ドメインのDNS設定にCNAMEレコードを追加
- [ ] SSL証明書の自動発行を確認（数分〜数十分）
- [ ] サブドメインでアクセス確認

### 8-4. n8n の常時稼働化（VPS移行）
- [ ] VPS選定・契約（さくらVPS / Render / Railway 等）
- [ ] VPSにDockerインストール
- [ ] n8nを VPS に移行（ワークフローのエクスポート → インポート）
- [ ] Credentials（APIキー等）を再設定
- [ ] 自動実行の動作確認

### 8-5. 公開後の確認
- [ ] サブドメインで全ページの表示確認
- [ ] Firestoreセキュリティルールが正しく機能しているか確認
- [ ] n8nの定期実行がVPSで動いているか確認

---

## バックログ（将来対応）

- [ ] Slack / LINE 通知（日次要約を通知）
- [ ] 重要度スコアリングの精度向上
- [ ] 記事の全文取得（RSS概要文だけでなく）
- [ ] X（Twitter）API連携
- [ ] UIダッシュボードの拡充

---

## 進捗メモ

| 日付 | 作業内容 |
|---|---|
| 2026-05-04 | Phase 0 完了。要件定義・設計・レクチャー作成。外部公開（Firebase App Hosting + サブドメイン）をPhase 8として追加 |
