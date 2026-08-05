# 監視・アラート

本システムの監視は 2 系統ある。

| 系統 | 目的 | 対応 Issue |
|---|---|---|
| [dailyFeed バッチの失敗検知](#1-dailyfeed-バッチの失敗検知) | 日次バッチのコケに翌朝までに気づく | #63 |
| [コスト監視](#2-コスト監視予算アラート) | 想定外の課金増に気づく | #83 |

---

## 1. dailyFeed バッチの失敗検知

Issue #63 対応。dailyFeed バッチの失敗に翌朝までに気づけるようにする。

### 仕組み（2層構成）

#### 1. コード側: 失敗を確実に ERROR ログにする

`functions/src/index.ts` の `dailyFeed` は以下の方針でログを出す。

- **個別の失敗は許容**: RSSソース単位・スコアリングチャンク単位・記事単位の失敗は `warn`（従来どおり）
- **全滅系の失敗は throw**: 以下は API 障害・キー失効など系統的な問題なので例外を投げ、実行を失敗させる
  - スコアリングが全チャンクで失敗
  - 要約対象があるのに 1 件も保存できなかった
  - 日次要約の生成に失敗
- 例外は Cloud Functions のフレームワークが **severity=ERROR** でログに記録する
- 正常終了時は成功マーカー `[ai-radar] dailyFeed succeeded for <date>` を出力する

#### 2. インフラ側: ERROR ログをメール通知する

Cloud Monitoring のログベースアラートポリシー **`[ai-radar] dailyFeed error`** が
`resource.labels.service_name="dailyfeed" AND severity>=ERROR` にマッチしたログを検知し、
メール通知チャンネル **`ai-radar alerts`** に送信する。

- 通知は 1 時間に 1 通まで（rate limit）、インシデントは 24 時間で自動クローズ
- 料金: ログベースアラート・メール通知チャンネルとも無料枠内

### セットアップ手順（初回のみ）

ローカルに gcloud CLI がない場合は [Cloud Shell](https://shell.cloud.google.com) で実行する。

```bash
git clone https://github.com/Shunnie816/ai-radar.git && cd ai-radar
bash scripts/setup-monitoring.sh <通知先メールアドレス>
```

スクリプトは再実行しても安全（既存のチャンネル・ポリシーがあれば再利用してスキップ）。

### 動作確認

1. [Monitoring > Alerting](https://console.cloud.google.com/monitoring/alerting?project=ai-radar-92cf1) にポリシー `[ai-radar] dailyFeed error` が表示されること
2. [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=ai-radar-92cf1) から dailyFeed を「強制実行」し、
   [Logs Explorer](https://console.cloud.google.com/logs/query?project=ai-radar-92cf1) で
   `[ai-radar] dailyFeed succeeded` が出ていること（正常時）
3. 失敗時はエラー発生から数分以内にメールが届く

### 通知が届いたら

1. メール内のリンク（Logs Explorer）でエラー内容を確認する
2. 原因を解消後、Cloud Scheduler から dailyFeed を強制実行して再処理する
   （URL 重複チェックがあるため二重取り込みの心配はない）

### 採用しなかった案: 成功ログの不在検知

「24 時間成功マーカーが出ていなければ通知」する metric-absence 方式は、
Cloud Monitoring の不在検知 duration の上限が 24 時間で日次ジョブの実行間隔と同じため、
実行時刻のわずかなズレで誤報が出やすく見送った。

Cloud Scheduler 自体が起動しなくなるケース（デプロイ漏れ・ジョブ削除など）はこの構成では
検知できないが、その場合も scheduler ジョブの失敗は Cloud Scheduler 側のログ
（`resource.type="cloud_scheduler_job"` の severity=ERROR）に残る。必要になったら
成功マーカー（出力済み）を使った log-based metric + 25 時間窓のしきい値監視を追加する。

---

## 2. コスト監視（予算アラート）

Issue #83 対応。一般公開でトラフィックが増えた際、Firebase 側の課金増に気づけるようにする。

### 設定内容

GCP の [Billing > 予算とアラート](https://console.cloud.google.com/billing/budgets) に予算を作成済み。

| 項目 | 設定値 |
|---|---|
| 対象プロジェクト | `ai-radar-92cf1` |
| 予算額（月） | **¥500** |
| 通知しきい値 | **¥100**（20%） / **¥250**（50%） / **¥500**（100%） |
| 通知先 | 請求先アカウント管理者（デフォルト） |

平常時の GCP 利用料は無料枠内でほぼ ¥0 のため、最初のしきい値 ¥100 が事実上の「無料枠を超え始めた」サインになる。

### Claude API のコスト（Anthropic 側で別管理）

**Claude API の利用料は Anthropic 側の課金であり、上記の GCP 予算アラートには含まれない。**
README のコスト試算（月 ~$3〜5）の大半は Claude API 分なので、金額の大きい方は別系統で管理している。

[Anthropic Console](https://console.anthropic.com/) 側の設定は以下のとおり。

| 項目 | 設定値 |
|---|---|
| 月間利用上限 | **$5**（上限到達で API 呼び出しが停止する） |
| 通知しきい値 | **$4** 到達時にメール |
| 対象範囲 | **Anthropic アカウント全体**（ai-radar 以外のアプリの利用分も合算される） |

#### ⚠️ 上限に対してマージンが薄い

ai-radar 単体の試算が月 ~$3〜5 なのに対し、上限は他アプリと合算で $5。
**ai-radar 単体でも上限に達しうる**うえ、他アプリの利用が増えれば ai-radar の実行が先に止まる可能性がある。

上限に到達して Claude API がエラーを返した場合、dailyFeed はスコアリング・要約が全滅して例外を投げるため、
[1. dailyFeed バッチの失敗検知](#1-dailyfeed-バッチの失敗検知) の ERROR アラートでメール通知される。
**コスト起因の停止も既存のバッチ失敗アラートで検知できる**が、通知を受けた際は Anthropic Console の
使用量も確認して原因を切り分けること。

$4 の通知が毎月届くようであれば、上限額の引き上げか [Issue #52（コスト削減）](https://github.com/Shunnie816/ai-radar/issues/52) の対応を検討する。

### 公開後に増えるのはどちら側か

Claude API のコストは 1 日 1 回のバッチ実行に連動するため、**Web の閲覧数が増えても直接は増えない**。
公開後に増えるのは Firestore の read と App Hosting の実行時間・帯域で、こちらは GCP 予算アラートでカバーされる。

### 通知が届いたら

1. [Billing > レポート](https://console.cloud.google.com/billing/reports) でサービス別の内訳を確認する
2. Firestore の read が支配的な場合は、Web 側のキャッシュ戦略（`revalidate` の見直し）を検討する
3. 急増が攻撃的なトラフィックによるものであれば、App Hosting の `maxInstances` を絞って上限を作る

### 検討したが見送った案

**Firestore の read 数そのものの監視**

Cloud Monitoring の Firestore 指標でドキュメント読み取り数にしきい値を張ることは可能だが、
無料枠の消費ペースに応じたしきい値のチューニングが必要で、運用コストに見合わないと判断した。
金額ベースの予算アラート（¥100 の時点で通知）で十分早期に気づけるため、当面は不要とする。

**App Hosting の `maxInstances` 引き下げ**

`apps/web/apphosting.yaml` の設定は `minInstances: 0` / `maxInstances: 10` / `concurrency: 100`。
アイドル時のインスタンスが 0 なので平常時のコストは発生せず、上限側も 10 インスタンスで頭打ちになる。
バースト時のコスト上限として妥当なため現状維持とする。
