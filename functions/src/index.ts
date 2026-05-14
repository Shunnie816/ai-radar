import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";

admin.initializeApp();
const db = admin.firestore();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const rssParser = new Parser({ timeout: 10000 });

const HOURS_LOOKBACK = 26; // 24h + 2h buffer for timezone edge cases
const MAX_ARTICLES_PER_SOURCE = 5;

const RSS_SOURCES = [
  { url: "https://openai.com/news/rss.xml", source: "OpenAI Blog" },
  { url: "https://deepmind.google/blog/rss.xml", source: "Google DeepMind" },
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", source: "AWS ML Blog" },
  { url: "https://cloudblog.withgoogle.com/rss", source: "Google Cloud Blog" },
  { url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", source: "ITmedia AI" },
  { url: "https://zenn.dev/topics/ai/feed", source: "Zenn AI" },
];

const SUMMARY_SYSTEM_PROMPT = `あなたはAI業界のアナリストです。記事を日本語で簡潔に要約し、重要度を採点してください。

必ず以下のJSON形式のみで回答してください（説明文や前置き不要）：
{
  "summary": "何が起きたか・なぜ重要か・誰に影響があるかを2〜4文で",
  "scores": {
    "technicalImpact": <0〜3の整数>,
    "practicalImpact": <0〜3の整数>,
    "reliability": <0〜2の整数>,
    "trendRelevance": <0〜2の整数>
  },
  "totalScore": <合計点 0〜10>,
  "importance": "high | medium | low",
  "tags": ["タグ1", "タグ2"]
}

採点基準：

【技術インパクト】0〜3点
- 3点: 新モデル・新アーキテクチャの発表、または業界水準を塗り替えるブレークスルー研究
- 2点: 既存技術の大幅改善・新API・新機能の追加
- 1点: マイナーアップデート・バグ修正・小改善
- 0点: 技術的変化なし（解説・意見記事など）

【実務影響】0〜3点
- 3点: 多くの開発者・企業が即座に影響を受ける（価格変更・API破壊的変更・規制など）
- 2点: 特定分野・職種の実務者に直接影響するアップデート
- 1点: 将来的に影響しうるが、現時点では限定的
- 0点: 実務への影響なし

【信頼性】0〜2点
- 2点: 公式発表・査読済み論文・著名機関（OpenAI / Google / Meta など）からの情報
- 1点: 信頼できるメディア・専門家の分析・技術ブログ
- 0点: 個人ブログ・未検証情報・憶測

【トレンド性】0〜2点
- 2点: 記事内容から業界横断的な動きが読み取れる（複数企業・組織の動向、複数メディアへの言及など）
- 1点: 新規性はあるが言及範囲は限定的（単一企業・単一事例）
- 0点: 既知情報の焼き直し・話題性なし

importance の決定ルール（totalScore を使う）:
- high  : 7〜10点（業界全体への高インパクト）
- medium: 4〜6点（特定分野への中程度のインパクト）
- low   : 0〜3点（マイナーな情報・読み物）`;

interface Article {
  title: string;
  url: string;
  source: string;
  publishedAt: admin.firestore.Timestamp;
  rawContent: string;
}

interface ArticleSummary {
  summary: string;
  scores: {
    technicalImpact: number;
    practicalImpact: number;
    reliability: number;
    trendRelevance: number;
  };
  totalScore: number;
  importance: "high" | "medium" | "low";
  tags: string[];
}

// ─── RSS 取得 ────────────────────────────────────────────────────────────────

async function fetchRssArticles(): Promise<Article[]> {
  const cutoff = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000);

  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ url, source }) => {
      const feed = await rssParser.parseURL(url);
      return feed.items
        .map((item) => ({
          title: item.title ?? "",
          url: item.link ?? item.guid ?? "",
          source,
          publishedAt: admin.firestore.Timestamp.fromDate(
            item.pubDate ? new Date(item.pubDate) : new Date()
          ),
          rawContent: item.contentSnippet ?? item.content ?? item.summary ?? "",
        }))
        .filter((a) => a.publishedAt.toDate() >= cutoff)
        .slice(0, MAX_ARTICLES_PER_SOURCE);
    })
  );

  const perSource = results.map((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  return roundRobin(perSource);
}

// ─── 重複チェック ─────────────────────────────────────────────────────────────

async function filterNewArticles(articles: Article[]): Promise<Article[]> {
  const urls = articles.map((a) => a.url).filter(Boolean);
  if (urls.length === 0) return [];

  const existing = new Set<string>();
  // Firestore の in 演算子は30件まで
  const chunks = chunkArray(urls, 30);
  for (const chunk of chunks) {
    const snap = await db.collection("articles").where("url", "in", chunk).get();
    snap.forEach((doc) => existing.add(doc.data().url));
  }

  return articles.filter((a) => a.url && !existing.has(a.url));
}

// ─── Claude API: 記事単体要約 ──────────────────────────────────────────────────

async function summarizeArticle(article: Article): Promise<ArticleSummary | null> {
  const userContent = `タイトル: ${article.title}\n本文: ${article.rawContent.slice(0, 2000)}`;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(extractJson(text)) as ArticleSummary;
  } catch (e) {
    logger.warn(`summarizeArticle failed for "${article.title}"`, e);
    return null;
  }
}

// ─── Claude API: 日次要約 ──────────────────────────────────────────────────────

async function generateDailySummary(
  articles: (Article & ArticleSummary & { id: string })[]
): Promise<{ summary: string; keyTopics: string[] } | null> {
  const highArticles = articles.filter((a) => a.importance === "high");
  const targets = highArticles.length > 0
    ? highArticles
    : articles.filter((a) => a.importance === "medium");

  if (targets.length === 0) {
    logger.info("no high or medium articles available for daily summary");
    return null;
  }

  logger.info(`daily summary: using ${targets.length} articles (importance=${highArticles.length > 0 ? "high" : "medium fallback"})`);

  const articleList = targets
    .map((a) => `- [${a.importance}/${a.totalScore}点] ${a.title} (${a.source})\n  ${a.summary}`)
    .join("\n");
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `今日収集したAI関連記事から日次トレンド要約を生成してください。

記事一覧:
${articleList}

必ず以下のJSON形式のみで回答してください：
{
  "summary": "今日のトレンドの方向性（200字以内）",
  "keyTopics": ["トピック1", "トピック2", "トピック3"]
}`,
        },
      ],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(extractJson(text)) as { summary: string; keyTopics: string[] };
  } catch (e) {
    logger.warn("generateDailySummary failed", e);
    return null;
  }
}

// ─── Firestore 保存 ───────────────────────────────────────────────────────────

async function saveArticles(
  articles: Article[],
  summaries: (ArticleSummary | null)[]
): Promise<(Article & ArticleSummary & { id: string })[]> {
  const saved: (Article & ArticleSummary & { id: string })[] = [];
  const batch = db.batch();

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const summary = summaries[i];
    if (!summary) continue;

    const ref = db.collection("articles").doc();
    const data = {
      title: article.title,
      source: article.source,
      url: article.url,
      publishedAt: article.publishedAt,
      rawContent: article.rawContent,
      summary: summary.summary,
      scores: summary.scores,
      totalScore: summary.totalScore,
      importance: summary.importance,
      tags: summary.tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(ref, data);
    saved.push({ ...article, ...summary, id: ref.id });
  }

  await batch.commit();
  return saved;
}

async function saveDailySummary(
  date: string,
  result: { summary: string; keyTopics: string[] },
  articleIds: string[],
  articleCount: number
): Promise<void> {
  await db.collection("daily_summaries").doc(date).set({
    date,
    summary: result.summary,
    keyTopics: result.keyTopics,
    articleCount,
    articleIds,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function capPerSource(articles: Article[], max: number): Article[] {
  const counts = new Map<string, number>();
  return articles.filter((a) => {
    const n = counts.get(a.source) ?? 0;
    if (n >= max) return false;
    counts.set(a.source, n + 1);
    return true;
  });
}

function roundRobin<T>(arrays: T[][]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(0, ...arrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function getTodayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new SyntaxError("No JSON object found in response");
  return match[0];
}

// Claude API rate limit: 50 req/min → 1.5s interval で ~40 req/min に抑える
async function summarizeArticlesSequentially(
  articles: Article[]
): Promise<(ArticleSummary | null)[]> {
  const results: (ArticleSummary | null)[] = [];
  for (let i = 0; i < articles.length; i++) {
    results.push(await summarizeArticle(articles[i]));
    if (i < articles.length - 1) await sleep(1500);
  }
  return results;
}

// ─── メイン関数 ───────────────────────────────────────────────────────────────

export const dailyFeed = onSchedule(
  {
    schedule: "0 21 * * *", // 06:00 JST
    timeZone: "UTC",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: ["ANTHROPIC_API_KEY"],
  },
  async () => {
    const date = getTodayJst();
    logger.info(`[ai-radar] starting daily feed for ${date}`);

    // 1. RSS 取得
    const allArticles = await fetchRssArticles();
    logger.info(`fetched ${allArticles.length} articles from RSS`);

    // 2. 重複チェック
    const newArticles = await filterNewArticles(allArticles);
    logger.info(`${newArticles.length} new articles after dedup`);

    if (newArticles.length === 0) {
      logger.info("no new articles today, skipping");
      return;
    }

    // 3. 記事単体要約（逐次実行・最大50件、1ソースあたり最大7件）
    const targets = capPerSource(newArticles, 7).slice(0, 50);
    const summaries = await summarizeArticlesSequentially(targets);

    // 4. Firestore 保存
    const savedArticles = await saveArticles(targets, summaries);
    logger.info(`saved ${savedArticles.length} articles to Firestore`);

    if (savedArticles.length === 0) return;

    // 5. 日次要約生成
    const dailyResult = await generateDailySummary(savedArticles);
    if (!dailyResult) {
      logger.warn("daily summary generation failed");
      return;
    }

    // 6. 日次要約保存
    await saveDailySummary(
      date,
      dailyResult,
      savedArticles.map((a) => a.id),
      savedArticles.length
    );
    logger.info(`[ai-radar] completed for ${date}`);
  }
);
