#!/usr/bin/env bash
# Cloud Monitoring アラート設定スクリプト（Issue #63）
#
# dailyFeed バッチが ERROR ログを記録したらメール通知するアラートを作成する。
# gcloud が必要なため、Cloud Shell（https://shell.cloud.google.com）での実行を推奨。
#
# 使い方:
#   bash scripts/setup-monitoring.sh <通知先メールアドレス>
#
# 再実行しても既存のチャンネル・ポリシーは再利用されるだけで重複作成はしない。
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-radar-92cf1}"
EMAIL="${1:?通知先メールアドレスを指定してください（例: bash scripts/setup-monitoring.sh you@example.com）}"
CHANNEL_NAME="ai-radar alerts"
POLICY_NAME="[ai-radar] dailyFeed error"

echo "project: ${PROJECT_ID}"
echo "email:   ${EMAIL}"

# ── 1. メール通知チャンネル ──────────────────────────────────────────────
CHANNEL=$(gcloud beta monitoring channels list \
  --project "${PROJECT_ID}" \
  --filter "displayName=\"${CHANNEL_NAME}\" AND type=\"email\"" \
  --format "value(name)" | head -n 1)

if [ -z "${CHANNEL}" ]; then
  CHANNEL=$(gcloud beta monitoring channels create \
    --project "${PROJECT_ID}" \
    --display-name "${CHANNEL_NAME}" \
    --type email \
    --channel-labels "email_address=${EMAIL}" \
    --format "value(name)")
  echo "created notification channel: ${CHANNEL}"
else
  echo "reusing notification channel: ${CHANNEL}"
fi

# ── 2. dailyFeed の ERROR ログ検知アラートポリシー ──────────────────────
EXISTING=$(gcloud alpha monitoring policies list \
  --project "${PROJECT_ID}" \
  --filter "displayName=\"${POLICY_NAME}\"" \
  --format "value(name)" | head -n 1)

if [ -n "${EXISTING}" ]; then
  echo "alert policy already exists: ${EXISTING} — skipped"
  exit 0
fi

POLICY_FILE=$(mktemp)
trap 'rm -f "${POLICY_FILE}"' EXIT
cat > "${POLICY_FILE}" <<EOF
{
  "displayName": "${POLICY_NAME}",
  "documentation": {
    "content": "dailyFeed バッチが ERROR ログを記録しました。Cloud Logging で詳細を確認してください。\n\nhttps://console.cloud.google.com/logs/query;query=resource.labels.service_name%3D%22dailyfeed%22%20severity%3E%3DERROR?project=${PROJECT_ID}",
    "mimeType": "text/markdown"
  },
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "dailyFeed severity>=ERROR",
      "conditionMatchedLog": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"dailyfeed\" AND severity>=ERROR"
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": { "period": "3600s" },
    "autoClose": "86400s"
  },
  "notificationChannels": ["${CHANNEL}"]
}
EOF

gcloud alpha monitoring policies create \
  --project "${PROJECT_ID}" \
  --policy-from-file "${POLICY_FILE}"
echo "created alert policy: ${POLICY_NAME}"
echo "done."
