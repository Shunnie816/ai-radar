import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";

admin.initializeApp();
const db = admin.firestore();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const rssParser = new Parser({ timeout: 10000 });

const RSS_SOURCES = [
  { url: "https://openai.com/news/rss.xml", source: "OpenAI Blog" },
  { url: "https://deepmind.google/blog/rss.xml", source: "Google DeepMind" },
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", source: "AWS ML Blog" },
  { url: "https://cloudblog.withgoogle.com/rss", source: "Google Cloud Blog" },
  { url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", source: "ITmedia AI" },
  { url: "https://zenn.dev/topics/ai/feed", source: "Zenn AI" },
];

const SUMMARY_SYSTEM_PROMPT = `あなたはAI業界のアナリストです。記事を日本語で簡潔に要約してください。

必ず以下のJSON形式のみで回答してください（説明文や前置き不要）：
{
  "summary": "何が起きたか・なぜ重要か・誰に影響があるかを2〜4文で",
  "importance": "high | medium | low",
  "tags": ["タグ1", "タグ2"]
}

importance の基準:
- high: 業界全体に影響する大型リリース・研究・政策
- medium: 特定分野や実務者に影響するアップデート
- low: マイナーな更新・Tips・個人の考察`;

interface Article {
  title: string;
  url: string;
  source: string;
  publishedAt: admin.firestore.Timestamp;
  rawContent: string;
}

interface ArticleSummary {
  summary: string;
  importance: "high" | "medium" | "low";
  tags: string[];
}

// ─── RSS 取得 ────────────────────────────────────────────────────────────────

async function fetchRssArticles(): Promise<Article[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ url, source }) => {
      const feed = await rssParser.parseURL(url);
      return feed.items.map((item) => ({
        title: item.title ?? "",
        url: item.link ?? item.guid ?? "",
        source,
        publishedAt: admin.firestore.Timestamp.fromDate(
          item.pubDate ? new Date(item.pubDate) : new Date()
        ),
        rawContent: item.contentSnippet ?? item.content ?? item.summary ?? "",
      }));
    })
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
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
  const articleList = articles
    .map((a) => `- [${a.importance}] ${a.title} (${a.source})\n  ${a.summary}`)
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

    // 3. 記事単体要約（逐次実行・最大50件）
    const targets = newArticles.slice(0, 50);
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
