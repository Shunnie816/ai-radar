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
const MAX_ARTICLES_TO_SCORE = 75;    // Haiku は安価なので多めに処理
const MAX_ARTICLES_TO_SUMMARIZE = 30; // Sonnet は high/medium のみに絞る
const SCORING_CHUNK_SIZE = 10;       // 1リクエストで採点する記事数（採点基準の送信回数を削減）

const MODEL_SCORING = "claude-haiku-4-5-20251001";
const MODEL_SUMMARY = "claude-sonnet-4-6";

const RSS_SOURCES = [
  // AI 大手・研究
  { url: "https://openai.com/news/rss.xml", source: "OpenAI Blog" },
  { url: "https://deepmind.google/blog/rss.xml", source: "Google DeepMind" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", source: "AWS ML Blog" },
  { url: "https://cloudblog.withgoogle.com/rss", source: "Google Cloud Blog" },
  { url: "https://huggingface.co/blog/feed.xml", source: "Hugging Face Blog" },
  { url: "https://engineering.fb.com/feed/", source: "Meta Engineering" },
  // セキュリティ
  { url: "https://feeds.feedburner.com/TheHackersNews", source: "The Hacker News" },
  { url: "https://krebsonsecurity.com/feed/", source: "Krebs on Security" },
  // テック・経済・トレンド
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://www.technologyreview.com/feed/", source: "MIT Technology Review" },
  { url: "https://www.wired.com/feed/rss", source: "Wired" },
  // 日本語
  { url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", source: "ITmedia AI" },
  { url: "https://zenn.dev/topics/ai/feed", source: "Zenn AI" },
  { url: "https://qiita.com/popular-items/feed", source: "Qiita Popular" },
];

// ─── プロンプト ───────────────────────────────────────────────────────────────

// Haiku: 重要度スコアリング専用（タイトル + 冒頭のみ・複数記事を一括採点）
const SCORING_SYSTEM_PROMPT = `あなたはAI・テック・セキュリティ記事の重要度を判定するアシスタントです。
【記事N】の形式で複数の記事が与えられます。各記事のタイトルと冒頭テキストをもとに重要度を採点してください。

必ず以下のJSON形式のみで回答してください（説明文や前置き不要）。results には与えられた全記事分の要素を必ず含めてください：
{
  "results": [
    {
      "index": <記事番号N>,
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
  ]
}

採点基準：

【技術インパクト】0〜3点
- 3点: 新モデル・新アーキテクチャ・重大な脆弱性・業界水準を塗り替えるブレークスルー
- 2点: 既存技術の大幅改善・新API・新機能・重要なセキュリティパッチ
- 1点: マイナーアップデート・小改善・軽微なセキュリティ情報
- 0点: 技術的変化なし（解説・意見記事など）

【実務影響】0〜3点
- 3点: 多くの開発者・企業が即座に影響を受ける（価格変更・API破壊的変更・規制・重大脆弱性など）
- 2点: 特定分野・職種の実務者に直接影響するアップデート
- 1点: 将来的に影響しうるが、現時点では限定的
- 0点: 実務への影響なし

【信頼性】0〜2点
- 2点: 公式発表・査読済み論文・著名機関・主要メディア（TechCrunch / Wired / MIT TR / THN / Krebs など）
- 1点: 技術コミュニティ（Zenn / Qiita / Hacker News など）
- 0点: 個人ブログ・未検証情報・憶測

【トレンド性】0〜2点
- 2点: 業界横断的な動き（複数企業・組織の動向・社会的影響）
- 1点: 新規性はあるが限定的（単一企業・単一事例）
- 0点: 既知情報の焼き直し・話題性なし

importance の決定ルール（totalScore を使う）:
- high  : 7〜10点
- medium: 4〜6点
- low   : 0〜3点`;

// Sonnet: 要約専用（スコアリングは Haiku が担当済み）
const SUMMARY_SYSTEM_PROMPT = `あなたはAI・テック・セキュリティ・経済トレンドのアナリストです。
記事を日本語で簡潔に要約してください。

必ず以下のJSON形式のみで回答してください（説明文や前置き不要）：
{
  "summary": "何が起きたか・なぜ重要か・誰に影響があるかを2〜4文で"
}`;

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface Article {
  title: string;
  url: string;
  source: string;
  publishedAt: admin.firestore.Timestamp;
  rawContent: string;
}

interface ScoringResult {
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

type ScoredArticle = Article & ScoringResult;
type SavedArticle = ScoredArticle & { summary: string; id: string };

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

// ─── Claude API: 重要度スコアリング（Haiku）─────────────────────────────────

// 約1,000トークンの採点基準（システムプロンプト）を記事ごとに送るとコストが嵩むため、
// SCORING_CHUNK_SIZE 件を1リクエストにまとめて採点する
async function scoreArticleChunk(articles: Article[]): Promise<(ScoringResult | null)[]> {
  const userContent = articles
    .map((a, i) => `【記事${i + 1}】\nソース: ${a.source}\nタイトル: ${a.title}\n冒頭: ${a.rawContent.slice(0, 500)}`)
    .join("\n\n");
  try {
    const response = await anthropic.messages.create({
      model: MODEL_SCORING,
      // 途中で切れると chunk 全体のJSONパースが失敗するため余裕を持たせる（課金は生成分のみ）
      max_tokens: 4096,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(extractJson(text)) as {
      results: (ScoringResult & { index: number })[];
    };
    // モデルが一部の記事を落とす可能性があるため、位置ではなく index で突き合わせる
    // （index が "1" のように文字列で返っても外れないよう Number で正規化）
    const byIndex = new Map(parsed.results.map((r) => [Number(r.index), r]));
    return articles.map((_, i) => byIndex.get(i + 1) ?? null);
  } catch (e) {
    logger.warn(`scoreArticleChunk failed for ${articles.length} articles`, e);
    return articles.map(() => null);
  }
}

// ─── Claude API: 記事要約（Sonnet）──────────────────────────────────────────

async function summarizeArticle(article: Article): Promise<string | null> {
  const userContent = `タイトル: ${article.title}\n本文: ${article.rawContent.slice(0, 2000)}`;
  try {
    const response = await anthropic.messages.create({
      model: MODEL_SUMMARY,
      max_tokens: 256,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(extractJson(text)) as { summary: string };
    return parsed.summary;
  } catch (e) {
    logger.warn(`summarizeArticle failed for "${article.title}"`, e);
    return null;
  }
}

// ─── Claude API: 日次要約（Sonnet）──────────────────────────────────────────

async function generateDailySummary(
  articles: SavedArticle[]
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
      model: MODEL_SUMMARY,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `今日収集したAI・テック・セキュリティ関連記事から日次トレンド要約を生成してください。

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
  articles: ScoredArticle[],
  summaries: (string | null)[]
): Promise<SavedArticle[]> {
  const saved: SavedArticle[] = [];
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
      summary,
      scores: article.scores,
      totalScore: article.totalScore,
      importance: article.importance,
      tags: article.tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(ref, data);
    saved.push({ ...article, summary, id: ref.id });
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

// Haiku: SCORING_CHUNK_SIZE 件ずつ採点、チャンク間 1500ms インターバル（レート制限安全マージン）
async function scoreArticlesInChunks(
  articles: Article[]
): Promise<(ScoringResult | null)[]> {
  const results: (ScoringResult | null)[] = [];
  const chunks = chunkArray(articles, SCORING_CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i++) {
    results.push(...(await scoreArticleChunk(chunks[i])));
    if (i < chunks.length - 1) await sleep(1500);
  }
  return results;
}

// Sonnet: 1500ms インターバル（レート制限安全マージン）
async function summarizeArticlesSequentially(
  articles: Article[]
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
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

    // 3. 重要度スコアリング（Haiku: 安価・高速）
    const scoringTargets = capPerSource(newArticles, 7).slice(0, MAX_ARTICLES_TO_SCORE);
    logger.info(`scoring ${scoringTargets.length} articles with ${MODEL_SCORING} (${SCORING_CHUNK_SIZE} per request)`);
    const scores = await scoreArticlesInChunks(scoringTargets);

    // 4. high/medium のみ絞り込み（low は除外してコスト削減）
    const toSummarize: ScoredArticle[] = [];
    for (let i = 0; i < scoringTargets.length; i++) {
      const scoring = scores[i];
      if (scoring && scoring.importance !== "low") {
        toSummarize.push({ ...scoringTargets[i], ...scoring });
      }
    }
    const summarizeTargets = toSummarize.slice(0, MAX_ARTICLES_TO_SUMMARIZE);
    logger.info(
      `${summarizeTargets.length} articles pass scoring filter (high/medium), summarizing with ${MODEL_SUMMARY}`
    );

    // 5. 要約（Sonnet: high/medium 記事のみ）
    const summaries = await summarizeArticlesSequentially(summarizeTargets);

    // 6. Firestore 保存
    const savedArticles = await saveArticles(summarizeTargets, summaries);
    logger.info(`saved ${savedArticles.length} articles to Firestore`);

    if (savedArticles.length === 0) return;

    // 7. 日次要約生成（Sonnet）
    const dailyResult = await generateDailySummary(savedArticles);
    if (!dailyResult) {
      logger.warn("daily summary generation failed");
      return;
    }

    // 8. 日次要約保存
    await saveDailySummary(
      date,
      dailyResult,
      savedArticles.map((a) => a.id),
      savedArticles.length
    );
    logger.info(`[ai-radar] completed for ${date}`);
  }
);
