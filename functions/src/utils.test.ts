import { describe, it, expect } from "vitest";
import { capPerSource, chunkArray, extractJson, getTodayJst, roundRobin } from "./utils";

describe("roundRobin", () => {
  it("should interleave items from each source one by one", () => {
    const interleaved = roundRobin([
      ["a1", "a2"],
      ["b1", "b2"],
    ]);

    expect(interleaved).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("should keep all items when array lengths differ", () => {
    const interleaved = roundRobin([["a1", "a2", "a3"], ["b1"]]);

    expect(interleaved).toEqual(["a1", "b1", "a2", "a3"]);
  });

  it("should return an empty array when there are no sources", () => {
    expect(roundRobin([])).toEqual([]);
  });

  it("should return an empty array when all sources are empty", () => {
    expect(roundRobin([[], []])).toEqual([]);
  });
});

describe("capPerSource", () => {
  const article = (source: string, title: string) => ({ source, title });

  it("should keep at most the given number of articles per source", () => {
    const articles = [article("A", "a1"), article("A", "a2"), article("A", "a3")];

    const capped = capPerSource(articles, 2);

    expect(capped).toEqual([article("A", "a1"), article("A", "a2")]);
  });

  it("should cap each source independently and preserve order", () => {
    const articles = [
      article("A", "a1"),
      article("B", "b1"),
      article("A", "a2"),
      article("B", "b2"),
    ];

    const capped = capPerSource(articles, 1);

    expect(capped).toEqual([article("A", "a1"), article("B", "b1")]);
  });

  it("should return all articles when every source is within the cap", () => {
    const articles = [article("A", "a1"), article("B", "b1")];

    expect(capPerSource(articles, 5)).toEqual(articles);
  });
});

describe("chunkArray", () => {
  it("should split an array into chunks of the given size with the remainder last", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("should return a single chunk when the array fits within the size", () => {
    expect(chunkArray([1, 2], 30)).toEqual([[1, 2]]);
  });

  it("should return an empty array for an empty input", () => {
    expect(chunkArray([], 30)).toEqual([]);
  });
});

describe("extractJson", () => {
  it("should extract a JSON object embedded in surrounding text", () => {
    const text = '以下が結果です。\n{"summary": "テスト"}\n以上です。';

    expect(extractJson(text)).toBe('{"summary": "テスト"}');
  });

  it("should return the whole text when it is a pure JSON object", () => {
    const text = '{"importance": "high"}';

    expect(extractJson(text)).toBe(text);
  });

  it("should throw SyntaxError when no JSON object is found", () => {
    expect(() => extractJson("JSONを含まない応答")).toThrow(SyntaxError);
  });
});

describe("getTodayJst", () => {
  it("should return the JST date in YYYY-MM-DD format", () => {
    const utcMorning = new Date("2026-01-15T03:00:00Z"); // JST 12:00

    expect(getTodayJst(utcMorning)).toBe("2026-01-15");
  });

  it("should stay on the same JST day just before 15:00 UTC", () => {
    const justBeforeJstMidnight = new Date("2026-01-15T14:59:59Z"); // JST 23:59:59

    expect(getTodayJst(justBeforeJstMidnight)).toBe("2026-01-15");
  });

  it("should roll over to the next JST day at 15:00 UTC", () => {
    const jstMidnight = new Date("2026-01-15T15:00:00Z"); // JST 翌日 00:00

    expect(getTodayJst(jstMidnight)).toBe("2026-01-16");
  });
});
