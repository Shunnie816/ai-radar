# セキュリティ

一般公開（public リポジトリ）に伴う防御方針をまとめる。

---

## 1. Firebase Web API キー

### なぜリポジトリに平文で入っているのか

`apps/web/apphosting.yaml` の `NEXT_PUBLIC_FIREBASE_API_KEY` はリポジトリ内に平文で存在するが、これは Firebase の設計どおり。

Firebase Web SDK の API キーは**プロジェクトを識別する公開情報であり、秘密情報ではない**。ブラウザに配信される JS バンドルには必ず含まれるため、そもそも隠すことができない。実際の防御は以下の 3 層で行う。

| 層 | 内容 | 状態 |
|---|---|---|
| Firestore セキュリティルール | 誰が何を読み書きできるか | 適用済み（[後述](#2-firestore-セキュリティルール)） |
| Firebase Auth の承認済みドメイン | どのドメインからログインできるか | 確認済み（[後述](#3-firebase-auth-の承認済みドメイン)） |
| API キーの API 制限 | キーでどの API を叩けるか | 適用済み（本章） |

### API 制限（適用済み）

Issue #81 対応。Firebase が自動作成した `Browser key (auto created by Firebase)` は既定で **27 個**の API を許可していたが、実際に使うのは 5 個だけのため絞り込んだ。

| 許可している API | 用途 |
|---|---|
| `identitytoolkit.googleapis.com` | Google ログイン |
| `securetoken.googleapis.com` | ID トークンの更新 |
| `firestore.googleapis.com` | 記事・サマリー取得（SSR）、コメント・お気に入り（ブラウザ） |
| `firebaseinstallations.googleapis.com` | Firebase JS SDK の installation 登録 |
| `firebase.googleapis.com` | SDK の構成取得 |

削除した主なもの: `sqladmin` / `logging` / `firebasestorage` / `firebaseml` / `firebasevertexai` / `firebasedatabase` / `firebasehosting` ほか計 22 個。

適用コマンド（キー名は `gcloud services api-keys list --project=ai-radar-92cf1` で確認）:

```bash
gcloud services api-keys update <KEY_NAME> \
  --api-target=service=firestore.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com \
  --api-target=service=firebaseinstallations.googleapis.com \
  --api-target=service=firebase.googleapis.com
```

`--api-target` は**指定した内容で全置換**される。変更前の一覧を控えてから実行すること。

### ⚠️ HTTP リファラー制限をかけてはいけない

一般的な対策としてブラウザキーには HTTP リファラー制限を設定するが、**本プロジェクトの現在の構成では設定してはいけない**。

`apps/web/lib/firestore.ts` は Firestore REST API を `?key=<APIキー>` 付きで呼んでいるが、これを import しているのは Server Component と API Route のみで、**リクエストは Cloud Run のサーバーから発行される**。サーバー発のリクエストには `Referer` ヘッダーが付かないため、リファラー制限を設定すると 403 になり、トップページ・記事一覧・記事詳細・日次ページのデータ取得が全滅する。

一方でブラウザ側（Auth・コメント・お気に入り）は `Referer` が付くため生き残る。結果として**「一部だけ壊れる」原因のわかりにくい障害**になる。

将来リファラー制限をかけたい場合は、先に以下のどちらかが必要。

1. **キーを 2 つに分ける** — ブラウザ用（リファラー制限あり・公開）とサーバー用（Secret Manager 管理・非公開）に分離し、`lib/firestore.ts` はサーバー用キーを使う
2. **サーバー側を Firebase Admin SDK + ADC に移行** — API キー自体を使わなくする。ただし `fetch` の `next: { revalidate }` キャッシュが使えなくなるため、現在のキャッシュ設計（記事詳細 `force-cache` / 一覧 3600 秒 / サマリー 86400 秒）を作り直す必要があり、Firestore の read 数とコストにも影響する

---

## 2. Firestore セキュリティルール

`firestore.rules` の要約。

| パス | 読み取り | 書き込み |
|---|---|---|
| `articles/{id}` | 全員 | 不可（バッチのみ Admin SDK 経由） |
| `daily_summaries/{id}` | 全員 | 不可（同上） |
| `articles/{id}/comments/{cid}` | 全員 | 作成はログインユーザー本人名義のみ（1〜500 字）。更新・削除は本人のみ。更新で変更できるのは `text` と `updatedAt` だけ |
| コレクショングループ `comments` | 本人のコメントのみ | — |
| `users/{uid}` | 全員（コメントの表示名・アイコン表示用） | 本人のみ |
| `users/{uid}/favorites/{id}` | 本人のみ | 本人のみ |

**レート制限は設けていない**ため、Google アカウントがあれば誰でもコメントを投稿できる。スパム対策は [Issue #82](https://github.com/Shunnie816/ai-radar/issues/82) で検討する。

---

## 3. Firebase Auth の承認済みドメイン

許可されたドメインからのみ Google ログインを実行できる。ここに第三者のドメインが混ざっていると、そのサイトから本プロジェクトの認証を利用されうる。

### 棚卸し結果（2026-08-06 時点）

登録されているのは以下のみで、**不要なドメインはなし**。削除対応は不要だった。

- `ai-radar.shunniehub.com`（本番のカスタムドメイン）
- `localhost`（ローカル開発）
- Firebase / App Hosting のデフォルトドメイン

### 確認手順

CLI（Identity Toolkit Admin API）は権限エラー（403）で参照できなかったため、コンソールで確認する。

[Firebase コンソール](https://console.firebase.google.com/project/ai-radar-92cf1/authentication/settings) > **Authentication > Settings > 承認済みドメイン**

カスタムドメインの追加・変更時や、外部サービスとの連携を試した後は、不要なドメインが残っていないか見直すこと。

---

## 4. API キーの制限を変更したときの確認手順

制限を変更したら、サーバー側とブラウザ側の両方を必ず確認する。**片方だけ壊れるケースがある**ため、両方見ないと気づけない。

1. **サーバー側**: `https://ai-radar.shunniehub.com/api/summaries` が 200 で件数を返すこと
   - このエンドポイントは `cache: 'no-store'` なので、キャッシュに邪魔されず必ず Firestore に到達する
   - `/api/articles` は `revalidate: 3600` でキャッシュされるため、確認には向かない
2. **ブラウザ側**: 記事詳細ページを開き、ブラウザコンソールにエラーが出ないこと（コメント欄がクライアント SDK で Firestore を読む）
3. **ログイン**: Google ログインが成功すること

ロールバックは、変更前の `--api-target` 一式を再適用する。

---

## 5. シークレットの管理

| 対象 | 管理方法 |
|---|---|
| `ANTHROPIC_API_KEY` | Firebase Secret Manager（`firebase functions:secrets:set`） |
| Firebase サービスアカウント鍵 | `secrets/` 配下・`.gitignore` 済み（リポジトリには含まれない） |
| `NEXT_PUBLIC_FIREBASE_*` | 公開情報のため `apphosting.yaml` に平文で記載（本章 1 のとおり） |

`.gitignore` は `.env` / `secrets/` / `*-firebase-adminsdk-*.json` / `*.pem` / `*.key` を除外している。Git 履歴にシークレットが混入していないことは公開前に確認済み。
