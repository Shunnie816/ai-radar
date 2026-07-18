// index.ts から切り出した純粋関数ユーティリティ（テスト: utils.test.ts）

// ソースごとの記事数を max 件までに制限する（元の並び順は維持）
export function capPerSource<T extends { source: string }>(articles: T[], max: number): T[] {
  const counts = new Map<string, number>();
  return articles.filter((a) => {
    const n = counts.get(a.source) ?? 0;
    if (n >= max) return false;
    counts.set(a.source, n + 1);
    return true;
  });
}

// 各配列から1件ずつ交互に取り出し、特定ソースへの偏りを防ぐ
export function roundRobin<T>(arrays: T[][]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(0, ...arrays.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

// Firestore の in 句上限（30件）などに合わせて配列を size 件ずつに分割する
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// JST の今日を YYYY-MM-DD で返す（sv-SE ロケールは ISO 形式になる）
// now はテストで日付境界を検証できるよう注入可能にしている
export function getTodayJst(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

// Claude 応答テキストから最初の JSON オブジェクト部分を抜き出す
export function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new SyntaxError("No JSON object found in response");
  return match[0];
}
