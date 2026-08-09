import { setSyntheticAllocationLimitForTesting } from "bun:internal-for-testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { truncateSync, unlinkSync, writeFileSync } from "fs";
import { bunEnv, bunExe, tempDir, tempDirWithFiles } from "harness";
import os from "node:os";
import path from "path";
describe("Memory", () => {
  beforeAll(() => {
    setSyntheticAllocationLimitForTesting(128 * 1024 * 1024);
  });
  afterEach(() => {
    Bun.gc(true);
  });

  describe("Blob", () => {
    let buf: ArrayBuffer;
    beforeAll(() => {
      buf = new ArrayBuffer(Math.floor(64 * 1024 * 1024));
    });

    test(".json() should throw an OOM without crashing the process.", () => {
      const array = [buf, buf, buf, buf, buf, buf, buf, buf, buf];
      expect(async () => await new Blob(array).json()).toThrow(
        "Cannot parse a JSON string longer than 2147483647 characters",
      );
    });

    test(".text() should throw an OOM without crashing the process.", () => {
      const array = [buf, buf, buf, buf, buf, buf, buf, buf, buf];
      expect(async () => await new Blob(array).text()).toThrow(
        "Cannot create a string longer than 2147483647 characters",
      );
    });

    test(".bytes() should throw an OOM without crashing the process.", () => {
      const array = [buf, buf, buf, buf, buf, buf, buf, buf, buf];
      expect(async () => await new Blob(array).bytes()).toThrow("Out of memory");
    });

    test(".arrayBuffer() should NOT throw an OOM.", () => {
      const array = [buf, buf, buf, buf, buf, buf, buf, buf, buf];
      expect(async () => await new Blob(array).arrayBuffer()).not.toThrow();
    });
  });

  describe("Response", () => {
    let blob: Blob;
    beforeAll(() => {
      const buf = new ArrayBuffer(Math.floor(64 * 1024 * 1024));
      blob = new Blob([buf, buf, buf, buf, buf, buf, buf, buf, buf]);
    });
    afterAll(() => {
      blob = undefined;
    });

    test(".text() should throw an OOM without crashing the process.", () => {
      expect(async () => await new Response(blob).text()).toThrow(
        "Cannot create a string longer than 2147483647 characters",
      );
    });

    test(".bytes() should throw an OOM without crashing the process.", async () => {
      expect(async () => await new Response(blob).bytes()).toThrow("Out of memory");
    });

    test(".arrayBuffer() should NOT throw an OOM.", async () => {
      expect(async () => await new Response(blob).arrayBuffer()).not.toThrow();
    });

    test(".json() should throw an OOM without crashing the process.", async () => {
      expect(async () => await new Response(blob).json()).toThrow(
        "Cannot parse a JSON string longer than 2147483647 characters",
      );
    });
  });

  describe("Request", () => {
    let blob: Blob;
    beforeAll(() => {
      const buf = new ArrayBuffer(Math.floor(64 * 1024 * 1024));
      blob = new Blob([buf, buf, buf, buf, buf, buf, buf, buf, buf]);
    });
    afterAll(() => {
      blob = undefined;
    });

    test(".text() should throw an OOM without crashing the process.", () => {
      expect(async () => await new Request("http://localhost:3000", { body: blob }).text()).toThrow(
        "Cannot create a string longer than 2147483647 characters",
      );
    });

    test(".bytes() should throw an OOM without crashing the process.", async () => {
      expect(async () => await new Request("http://localhost:3000", { body: blob }).bytes()).toThrow("Out of memory");
    });

    test(".arrayBuffer() should NOT throw an OOM.", async () => {
      expect(async () => await new Request("http://localhost:3000", { body: blob }).arrayBuffer()).not.toThrow();
    });

    test(".json() should throw an OOM without crashing the process.", async () => {
      expect(async () => await new Request("http://localhost:3000", { body: blob }).json()).toThrow(
        "Cannot parse a JSON string longer than 2147483647 characters",
      );
    });
  });
});

describe("Bun.file", () => {
  let tmpFile;
  beforeAll(async () => {
    const buf = Buffer.allocUnsafe(8 * 1024 * 1024);
    const tmpDir = tempDirWithFiles("file-oom", {
      "file.txt": buf,
    });
    tmpFile = path.join(tmpDir, "file.txt");
  });
  beforeEach(() => {
    setSyntheticAllocationLimitForTesting(4 * 1024 * 1024);
  });
  afterEach(() => {
    setSyntheticAllocationLimitForTesting(128 * 1024 * 1024);
  });
  afterAll(() => {
    try {
      unlinkSync(tmpFile);
    } catch (err) {
      console.error(err);
    }
  });

  test("text() should throw an OOM without crashing the process.", () => {
    expect(async () => await Bun.file(tmpFile).text()).toThrow();
  });

  test("bytes() should throw an OOM without crashing the process.", () => {
    expect(async () => await Bun.file(tmpFile).bytes()).toThrow();
  });

  test("json() should throw an OOM without crashing the process.", () => {
    expect(async () => await Bun.file(tmpFile).json()).toThrow();
  });

  test("arrayBuffer() should NOT throw an OOM.", () => {
    expect(async () => await Bun.file(tmpFile).arrayBuffer()).not.toThrow();
  });
});

// Byte lengths in [2^31, 2^32) used to abort the process instead of throwing:
// the Rust-side guards in front of WTF string construction only checked the
// synthetic allocation limit (2^32 - 1 by default) and missed
// WTF::StringImpl::MaxLength (2^31 - 1), tripping
// "ASSERTION FAILED: data.size() <= MaxLength" / a RELEASE_ASSERT in
// StringImplShape. Lengths >= 2^32 were already caught. These allocate a real
// 2 GiB, so each case runs in a subprocess to keep the peak away from the
// test runner, and the block skips on small machines (same gate as
// buffer.test.js's 4 GiB case).
describe.skipIf(os.totalmem() < 10 * 1024 ** 3)("byte sources at the 2 GiB string limit", () => {
  test("Blob.text() and Blob.json() at 2^31 bytes throw ERR_STRING_TOO_LONG instead of aborting", async () => {
    await using proc = Bun.spawn({
      cmd: [
        bunExe(),
        "-e",
        `
          const results = [];
          const report = e => ({ name: e.name, code: e.code, message: e.message });
          const blob = new Blob([new Uint8Array(2 ** 31)]);
          await blob.text().then(() => results.push("TEXT_UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          await blob.json().then(() => results.push("JSON_UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          console.log(JSON.stringify(results));
          `,
      ],
      env: bunEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    expect(JSON.parse(stdout.trim() || JSON.stringify({ stdout, stderr, exitCode }))).toEqual([
      {
        name: "Error",
        code: "ERR_STRING_TOO_LONG",
        message: "Cannot create a string longer than 2147483647 characters",
      },
      {
        name: "Error",
        code: "ERR_STRING_TOO_LONG",
        message: "Cannot parse a JSON string longer than 2147483647 characters",
      },
    ]);
    expect(exitCode).toBe(0);
  }, 90_000);

  test("Bun.file().text() at 2^31 bytes throws ERR_STRING_TOO_LONG instead of aborting", async () => {
    using dir = tempDir("blob-2gib", {});
    const file = path.join(String(dir), "big.txt");
    // Sparse where the filesystem supports it; reads back as 'x' + NUL bytes.
    writeFileSync(file, "x");
    truncateSync(file, 2 ** 31);
    await using proc = Bun.spawn({
      cmd: [
        bunExe(),
        "-e",
        `
          const results = [];
          const report = e => ({ name: e.name, code: e.code, message: e.message });
          await Bun.file(${JSON.stringify(file)}).text().then(() => results.push("UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          console.log(JSON.stringify(results));
          `,
      ],
      env: bunEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    expect(JSON.parse(stdout.trim() || JSON.stringify({ stdout, stderr, exitCode }))).toEqual([
      {
        name: "Error",
        code: "ERR_STRING_TOO_LONG",
        message: "Cannot create a string longer than 2147483647 characters",
      },
    ]);
    expect(exitCode).toBe(0);
    // Reads 2 GiB through the page cache; measured right at the default 5s
    // ceiling under load.
  }, 90_000);
});

// The utf8 encoding of a string body can exceed JSC's hard ArrayBuffer cap
// (2^32 bytes) even though the string itself is a valid length. These used to
// hand the encoded bytes to ArrayBuffer::createFromBytes, which RELEASE_ASSERTs
// past the cap and aborted the process; now the size is checked before
// encoding. The string alone is ~2.9 GiB, so the case runs in a subprocess and
// the block is gated like the 2 GiB one above.
describe.skipIf(os.totalmem() < 10 * 1024 ** 3)("string bodies above the 4 GiB ArrayBuffer limit", () => {
  test("Response/Request arrayBuffer() and bytes() throw instead of aborting", async () => {
    await using proc = Bun.spawn({
      cmd: [
        bunExe(),
        "-e",
        `
          const results = [];
          const report = e => ({ name: e.name, message: e.message });
          const s = "\\u20ac".repeat(1431655766); // 3 utf8 bytes each -> 2**32 + 2
          await new Response(s).arrayBuffer().then(() => results.push("RESPONSE_ARRAYBUFFER_UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          await new Response(s).bytes().then(() => results.push("RESPONSE_BYTES_UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          await new Request("http://localhost/", { method: "POST", body: s }).arrayBuffer().then(() => results.push("REQUEST_ARRAYBUFFER_UNEXPECTED_SUCCESS"), e => results.push(report(e)));
          console.log(JSON.stringify(results));
          `,
      ],
      env: bunEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    const oom = { name: "RangeError", message: "Out of memory" };
    expect(JSON.parse(stdout.trim() || JSON.stringify({ stdout, stderr, exitCode }))).toEqual([oom, oom, oom]);
    expect(exitCode).toBe(0);
    // The subprocess writes and scans a real ~2.9 GiB string; debug/ASAN builds
    // need well over the default 5s.
  }, 90_000);
});
