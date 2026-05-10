# ai-radar 作業TODO

最終更新: 2026-05-10

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
- [x] Claude Code プロジェクト設定（.claude/settings.json）
- [x] gitリポジトリ作成・初回コミット

---

## Phase 1: Firebase セットアップ ✅

- [x] **1-1.** Firebaseプロジェクト作成
  - Firebase Console でプロジェクト新規作成
  - プロジェクト名: `ai-radar`
- [x] **1-2.** Firestoreデータベース作成
  - モード: `production mode`（後でルール設定）
  - リージョン: `asia-northeast1`（東京）
- [x] **1-3.** Firestoreセキュリティルール設定
  - 読み取り: 公開（外部公開のため全ユーザー許可）
  - 書き込み: 全拒否（n8nはAdmin SDKで書く）
- [x] **1-4.** Firestoreインデックス設定
  - `articles`: `publishedAt DESC` + `source`（複合インデックスのみ作成。単一フィールドは自動）
- [x] **1-5.** Firebase Admin SDK用サービスアカウント作成
  - Google Cloud Console でサービスアカウント作成
  - ロールは `Cloud Datastore ユーザー` のみ付与（Firebase Admin は不可）
  - JSON秘密鍵をダウンロード → `secrets/` に保管（Git管理外）
- [x] **1-6.** Next.js用Firebaseアプリ設定
  - Webアプリを追加 → `firebaseConfig` 取得
- [x] **1-7.** Firebase App Hosting 有効化
  - Firebase Console → App Hosting → 新しいバックエンド作成
  - GitHubリポジトリ接続済み・ルートディレクトリ: `apps/web`

---

## Phase 2: n8n セットアップ ✅

- [x] **2-1.** docker-compose.yml 作成
- [x] **2-2.** n8n Docker起動確認
  - `docker-compose up -d`
  - `localhost:5678` でGUIアクセス確認
- [x] **2-3.** n8n Credentials 登録
  - Anthropic API Key
  - Firebase Admin SDK（サービスアカウントJSON）
- [x] **2-4.** RSSフィードURLの動作確認
  - 各ソースのRSS URLが有効か確認
  - 実際に記事が取得できるか検証

---

## Phase 3: n8n ワークフロー実装 ✅

- [x] **3-1.** Schedule Trigger設定
  - 毎日 06:00 JST (21:00 UTC)
- [x] **3-2.** RSS Fetchノード作成（各ソース）
  - OpenAI Blog
  - Google DeepMind Blog
  - Hacker News
  - AWS ML Blog
  - Google Cloud Blog
  - ITmedia AI+
  - Zenn (AIタグ)
- [x] **3-3.** Merge ノードで記事を結合
- [x] **3-4.** 重複チェック実装
  - Firestoreから過去URLを取得
  - Code ノードで照合・除外
- [x] **3-5.** 記事単体要約ワークフロー
  - Loop Over Items
  - HTTP Request → Claude API
  - レスポンスパース（JSON抽出）
- [x] **3-6.** articles コレクションへの保存
- [x] **3-7.** 日次要約ワークフロー
  - 当日記事を集約
  - HTTP Request → Claude API（日次要約プロンプト）
- [x] **3-8.** daily_summaries コレクションへの保存
- [-] **3-9.** エラーハンドリング設定（バックログへ移動）
  - APIエラー時のリトライ
  - エラー通知（メール or Slack）

---

## Phase 4: 動作確認（n8n）

- [x] **4-1.** ワークフローの手動実行テスト
- [x] **4-2.** Firestoreにデータが正しく保存されているか確認
- [x] **4-3.** 日次要約が生成されるか確認
- [x] **4-4.** 重複チェックが機能するか確認（2回目の実行で重複なし）
- [ ] **4-5.** Schedule Trigger による自動実行確認

---

## Phase 5: Next.js アプリ構築 ✅

- [x] **5-1.** Next.js プロジェクト初期化（16.2.4 / App Router / TypeScript / Tailwind）
- [x] **5-2.** Firestore REST API 接続設定（Client SDK は Server Component 非対応のため REST API に変更）
- [x] **5-3.** 共通型定義 `lib/types.ts` 作成
- [x] **5-4.** API Routes 実装
  - `GET /api/summaries` - 日次要約一覧
  - `GET /api/summaries/[date]` - 特定日の要約
  - `GET /api/articles` - 記事一覧（フィルタ対応）
  - `GET /api/articles/[id]` - 記事詳細
- [x] **5-5.** ダッシュボードページ実装 (`/`)
- [x] **5-6.** 日次サマリーページ実装 (`/daily/[date]`)
- [x] **5-7.** 記事一覧ページ実装 (`/articles`)
- [x] **5-8.** 記事詳細ページ実装 (`/articles/[id]`)
- [x] **5-9.** 共通コンポーネント作成（DailySummaryCard / ArticleCard / TagBadge）

---

## Phase 6: 統合テスト・調整 ✅

- [x] **6-1.** n8n → Firestore → Next.js の全体フロー確認
- [x] **6-2.** 要約プロンプトの品質確認・調整（importance基準・keyTopics短縮）
- [x] **6-3.** UIの表示確認・微調整（グローバルNav・記事一覧フィルタ・キャッシュ戦略）
- [x] **6-4.** エラーケースの確認（重複記事・フィルタ0件・staleキャッシュ）

---

## Phase 7: ローカル運用・検証

- [ ] **7-1.** n8n の自動実行で数日間データ蓄積
- [ ] **7-2.** 実際に毎日利用して使い勝手を確認
- [ ] **7-3.** 不要なソース・追加したいソースの調整

---

## Phase 8: 外部公開

### 8-1. GitHubリポジトリ準備
- [x] GitHubリポジトリ作成・初回push
- [x] `.gitignore` で秘密情報を除外
  - `.env.local`
  - `*.json`（サービスアカウントキー）
  - `n8n/` 内の認証情報ファイル

### 8-2. Firebase App Hosting デプロイ
- [x] `apps/web/apphosting.yaml` 作成
- [x] Firebase App Hosting とGitHubリポジトリを接続
- [x] 環境変数を Firebase App Hosting コンソールに設定
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- [x] main ブランチ push → 自動デプロイ確認

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

## Phase 9: Cloud Functions 移行（n8n 廃止）

- [x] **9-0.** v0.0.0 タグ作成（n8n ベース MVP を GitHub pre-release で保全）
- [x] **9-1.** Cloud Functions プロジェクト初期化（`functions/` ディレクトリ・TypeScript）
- [x] **9-2.** ワークフロー実装（`functions/src/index.ts`）
  - RSS 取得・重複チェック・Claude API 要約・Firestore 保存・日次要約生成
  - `onSchedule("0 21 * * *")` で Cloud Scheduler 内包
- [ ] **9-3.** ANTHROPIC_API_KEY を Secret Manager に登録
- [ ] **9-4.** Cloud Functions デプロイ（`firebase deploy --only functions`）
- [x] **9-5.** 手動実行で動作確認（Firestore にデータ保存されるか）
- [x] **9-6.** 翌日の自動実行確認
- [x] **9-7.** n8n 関連ファイルの整理（docker-compose.yml・n8n/ ディレクトリ削除）
- [x] **9-8.** 設計書更新（design.md を Cloud Functions 構成に書き換え）

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
| 2026-05-05 | gitリポジトリ作成・初回コミット。Phase 0 完全完了 |
| 2026-05-05 | Phase 1 完了。Firebase プロジェクト・Firestore・App Hosting セットアップ |
| 2026-05-06 | Phase 2 完了。n8n Docker起動・Credentials登録・RSS URL全確認 |
| 2026-05-06 | Phase 3 完了。n8n ワークフロー実装（15ノード）。Firestore REST API経由で記事保存・日次サマリー生成を確認 |
| 2026-05-06 | Phase 4 完了（4-5除く）。手動実行・Firestore保存・日次要約・重複チェックすべて動作確認 |
| 2026-05-06 | Phase 5 完了。Next.js 16.2.4 アプリ構築。Firestore REST API 接続。4ページ + 3コンポーネント実装・動作確認 |
| 2026-05-07〜10 | Phase 6 完了。n8n→Firestore→Next.js 全フロー確認。プロンプト改善・重複排除・フィルタ修正・キャッシュ戦略整理・Firestoreインデックス一元管理 |
| 2026-05-10 | Phase 8-1・8-2 完了。GitHub接続・apphosting.yaml・環境変数設定・main push → 自動デプロイ確認済み。ローカルブランチ整理（main のみ残存）|
| 2026-05-10 | Phase 9 開始。v0.0.0 pre-release 作成。n8n → Cloud Functions 移行計画策定。functions/ ディレクトリ・TypeScript 実装完了（型チェック通過）|
| 2026-05-11 | Phase 9-5・9-6 完了。手動実行・自動実行ともに成功。Web UI でのデータ表示確認済み。|
| 2026-05-11 | Phase 9 完了。n8n ファイル削除・設計書を Cloud Functions 構成に更新。エコシステムを GCP/Firebase に統一。|
