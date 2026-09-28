# Proposal: warn when `bun test` skips tests because of a platform mismatch

## Problem

`bun:test` guards like `describe.skipIf(...)` / `test.skipIf(...)` are routinely
used with a `process.platform` condition. When the condition is false on the
machine running the tests, every guarded test is skipped and `bun test` still
exits 0. The only signal is a per-test `(skip)` line; there is:

1. no indication **why** a test was skipped (intentional feature-gate vs.
   running on the wrong platform), and
2. no aggregate warning when an entire file/suite was skipped for a
   platform-shaped reason — so a cross-platform CI matrix can be silently
   executing a fraction of a suite on the wrong platform and stay green.

This mirrors the already-accepted concern in oven-sh/bun#16611 (warn when
tests are skipped because of `test.only()`), applied to platform guards.

## Live repro (bun 1.4.2, Linux)

`proposals/repro/platform-mismatch.test.ts`:

```ts
import { describe, it, expect, test } from "bun:test";

describe.skipIf(process.platform !== "darwin")("darwin-only suite", () => {
  it("uses a macOS-only API", () => { expect(1).toBe(1); });
  it("uses another macOS-only API", () => { expect(2).toBe(2); });
});

test.skipIf(process.platform === "win32")("runs everywhere but windows", () => { expect(1).toBe(1); });
```

Actual output on linux:

```
(skip) darwin-only suite > uses a macOS-only API
(skip) darwin-only suite > uses another macOS-only API
(pass) runs everywhere but windows

 1 pass
 2 skip
 0 fail
```

Exit code 0. A contributor running this on linux with no macOS machine cannot
tell whether the two skips are intended or whether they just lost 2/3 of the
suite to a platform typo (e.g. `!== "darwin"` vs `=== "darwin"`).

## Proposed behavior

Keep the skip, but make it visible and diagnosable:

1. **Annotate the skip line when the skip condition is platform-shaped.**
   When a `skipIf`/`if` condition evaluates against `process.platform`
   (directly or via a simple comparison), print e.g.
   `(skip) darwin-only suite > uses a macOS-only API (platform: linux, guard expects darwin)`.
   Where the guard is opaque, fall back to the existing `(skip)` line.

2. **End-of-run warning when a whole file ends with 0 passes and only
   platform-shaped skips** (the fully-skipped-suite case), something like:
   ```
   warning: platform.test.ts ran 0 tests: 2 skipped (platform guards)
   ```
   Non-fatal; respects existing quiet flags (`--quiet` should suppress it,
   matching `(pass)` suppression, see test/cli/test/claudecode-flag.test.ts).

3. **Optional opt-out**: a `bunfig`/flag to silence the warning for suites
   that intentionally skip everything on a platform.

## Implementation pointers (Rust tree, current main)

- Per-test `(skip)` printing: `src/runtime/cli/test_command.rs:205`
  (`BasicResult::Skip => Output::pretty_fmt::<false>("(skip)")`).
- Skip accounting / summary: `src/runtime/cli/test_command.rs` —
  `metrics.skipped` (:284) and the summary increment (:1505) are where a
  per-file pass/skip tally for the end-of-run warning would live.
- The skip decision itself (where `skipIf` conditions evaluate to
  `BasicResult::Skip`): `src/runtime/test_runner/jest.rs`.

Detecting "platform-shaped" guards can be done at the JS layer
(`src/runtime/test_runner/jest.classes.ts` / the skipIf wrapper) by capturing
whether the condition closes over `process.platform`, or more conservatively
at the reporter layer by only applying the annotation when the condition's
source text contains `process.platform`.

## Prior art

- oven-sh/bun#16611 — warn on skips caused by `test.only()` (same class of
  silent-skip footgun; open feature request, no implementer).
- No existing issue/PR in oven-sh/bun covers a warning for platform-mismatch
  skips (searched 2026, terms: skipIf, platform skip, silent skip,
  cross-platform skip).
