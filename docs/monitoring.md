# 監視・アラート（dailyFeed バッチ）

Issue #63 対応。dailyFeed バッチの失敗に翌朝までに気づけるようにする。

## 仕組み（2層構成）

### 1. コード側: 失敗を確実に ERROR ログにする

`functions/src/index.ts` の `dailyFeed` は以下の方針でログを出す。

- **個別の失敗は許容**: RSSソース単位・スコアリングチャンク単位・記事単位の失敗は `warn`（従来どおり）
- **全滅系の失敗は throw**: 以下は API 障害・キー失効など系統的な問題なので例外を投げ、実行を失敗させる
  - スコアリングが全チャンクで失敗
  - 要約対象があるのに 1 件も保存できなかった
  - 日次要約の生成に失敗
- 例外は Cloud Functions のフレームワークが **severity=ERROR** でログに記録する
- 正常終了時は成功マーカー `[ai-radar] dailyFeed succeeded for <date>` を出力する

### 2. インフラ側: ERROR ログをメール通知する

Cloud Monitoring のログベースアラートポリシー **`[ai-radar] dailyFeed error`** が
`resource.labels.service_name="dailyfeed" AND severity>=ERROR` にマッチしたログを検知し、
メール通知チャンネル **`ai-radar alerts`** に送信する。

- 通知は 1 時間に 1 通まで（rate limit）、インシデントは 24 時間で自動クローズ
- 料金: ログベースアラート・メール通知チャンネルとも無料枠内

## セットアップ手順（初回のみ）

ローカルに gcloud CLI がない場合は [Cloud Shell](https://shell.cloud.google.com) で実行する。

```bash
git clone https://github.com/Shunnie816/ai-radar.git && cd ai-radar
bash scripts/setup-monitoring.sh <通知先メールアドレス>
```

スクリプトは再実行しても安全（既存のチャンネル・ポリシーがあれば再利用してスキップ）。

## 動作確認

1. [Monitoring > Alerting](https://console.cloud.google.com/monitoring/alerting?project=ai-radar-92cf1) にポリシー `[ai-radar] dailyFeed error` が表示されること
2. [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=ai-radar-92cf1) から dailyFeed を「強制実行」し、
   [Logs Explorer](https://console.cloud.google.com/logs/query?project=ai-radar-92cf1) で
   `[ai-radar] dailyFeed succeeded` が出ていること（正常時）
3. 失敗時はエラー発生から数分以内にメールが届く

## 通知が届いたら

1. メール内のリンク（Logs Explorer）でエラー内容を確認する
2. 原因を解消後、Cloud Scheduler から dailyFeed を強制実行して再処理する
   （URL 重複チェックがあるため二重取り込みの心配はない）

## 採用しなかった案: 成功ログの不在検知

「24 時間成功マーカーが出ていなければ通知」する metric-absence 方式は、
Cloud Monitoring の不在検知 duration の上限が 24 時間で日次ジョブの実行間隔と同じため、
実行時刻のわずかなズレで誤報が出やすく見送った。

Cloud Scheduler 自体が起動しなくなるケース（デプロイ漏れ・ジョブ削除など）はこの構成では
検知できないが、その場合も scheduler ジョブの失敗は Cloud Scheduler 側のログ
（`resource.type="cloud_scheduler_job"` の severity=ERROR）に残る。必要になったら
成功マーカー（出力済み）を使った log-based metric + 25 時間窓のしきい値監視を追加する。
