/**
 * RSS取得ロジックの動作確認スクリプト（Firestore・Claude API 不要）
 * 実行: node scripts/check-rss.mjs
 */

import Parser from "rss-parser";

const HOURS_LOOKBACK = 48;
const MAX_ARTICLES_PER_SOURCE = 10;

const RSS_SOURCES = [
  { url: "https://openai.com/news/rss.xml", source: "OpenAI Blog" },
  { url: "https://deepmind.google/blog/rss.xml", source: "Google DeepMind" },
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", source: "AWS ML Blog" },
  { url: "https://cloudblog.withgoogle.com/rss", source: "Google Cloud Blog" },
  { url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", source: "ITmedia AI" },
  { url: "https://zenn.dev/topics/ai/feed", source: "Zenn AI" },
];

function roundRobin(arrays) {
  const result = [];
  const maxLen = Math.max(0, ...arrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

async function main() {
  const rssParser = new Parser({ timeout: 10000 });
  const cutoff = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000);

  console.log(`\n[設定] 過去 ${HOURS_LOOKBACK}h / ソース上限 ${MAX_ARTICLES_PER_SOURCE}件`);
  console.log(`[cutoff] ${cutoff.toISOString()}\n`);

  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ url, source }) => {
      const feed = await rssParser.parseURL(url);
      const all = feed.items.length;
      const filtered = feed.items
        .map((item) => ({
          title: item.title ?? "",
          url: item.link ?? item.guid ?? "",
          source,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        }))
        .filter((a) => a.publishedAt >= cutoff)
        .slice(0, MAX_ARTICLES_PER_SOURCE);
      console.log(`[${source}] RSS全件: ${all} → 48h以内: ${filtered.length}件`);
      return filtered;
    })
  );

  const perSource = results.map((r, i) => {
    if (r.status === "rejected") {
      console.error(`[${RSS_SOURCES[i].source}] 取得失敗: ${r.reason?.message}`);
      return [];
    }
    return r.value;
  });

  const interleaved = roundRobin(perSource);
  const targets = interleaved.slice(0, 50);

  console.log(`\n[合計] ラウンドロビン後: ${interleaved.length}件 → 処理対象: ${targets.length}件\n`);
  console.log("─── 処理対象記事一覧 ───────────────────────────────────");
  targets.forEach((a, i) => {
    console.log(`${String(i + 1).padStart(2)}. [${a.source}] ${a.title}`);
    console.log(`    ${a.publishedAt.toISOString()}`);
  });
}

main().catch(console.error);
