import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { lockedMinutes, recordFailure, recordSuccess } = await import("./login-throttle");

describe("login-throttle", () => {
  it("5回続けて間違えると10分ロックされ、時間が過ぎると解除される", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) expect(recordFailure("ip-a", t)).toBe(false);
    expect(lockedMinutes("ip-a", t)).toBeNull();
    expect(recordFailure("ip-a", t)).toBe(true);
    expect(lockedMinutes("ip-a", t)).toBe(10);
    expect(lockedMinutes("ip-a", t + 10 * 60_000 + 1)).toBeNull();
    expect(lockedMinutes("ip-b", t)).toBeNull(); // 別の接続元には影響しない
  });
  it("成功すると失敗回数がリセットされる", () => {
    const t = 2_000_000;
    for (let i = 0; i < 4; i++) recordFailure("ip-c", t);
    recordSuccess("ip-c");
    expect(recordFailure("ip-c", t)).toBe(false);
  });
});
