import { describe, it, expect, test } from "bun:test";

// Entire suite silently skipped on non-darwin: 2 skips, 0 fails, exit 0.
describe.skipIf(process.platform !== "darwin")("darwin-only suite", () => {
  it("uses a macOS-only API", () => {
    expect(1).toBe(1);
  });
  it("uses another macOS-only API", () => {
    expect(2).toBe(2);
  });
});

test.skipIf(process.platform === "win32")("runs everywhere but windows", () => {
  expect(1).toBe(1);
});
