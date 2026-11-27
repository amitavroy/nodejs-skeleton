import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppLogger } from "../src/common/logger";
import { createDailyFileStream, formatLocalDate } from "../src/common/log-file";
import { loadConfig } from "../src/config";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "logs-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("daily log files", () => {
  it("writes to YYYY-MM-DD.log and starts a new file when the date changes", async () => {
    let now = new Date(2026, 10, 22, 23, 59); // 22 Nov 2026, local time
    const stream = createDailyFileStream(join(dir, "nested/logs"), () => now);
    stream.write('{"msg":"one"}\n');
    now = new Date(2026, 10, 23, 0, 1);
    stream.write('{"msg":"two"}\n');
    await stream.close();

    const logs = join(dir, "nested/logs");
    expect(readdirSync(logs).sort()).toEqual(["2026-11-22.log", "2026-11-23.log"]);
    expect(readFileSync(join(logs, "2026-11-22.log"), "utf8")).toBe('{"msg":"one"}\n');
    expect(readFileSync(join(logs, "2026-11-23.log"), "utf8")).toBe('{"msg":"two"}\n');
  });

  it("appends to the day's existing file (e.g. after a restart)", async () => {
    const now = new Date(2026, 0, 5, 12);
    writeFileSync(join(dir, "2026-01-05.log"), '{"msg":"before restart"}\n');
    const stream = createDailyFileStream(dir, () => now);
    stream.write('{"msg":"after restart"}\n');
    await stream.close();
    expect(readFileSync(join(dir, "2026-01-05.log"), "utf8")).toBe(
      '{"msg":"before restart"}\n{"msg":"after restart"}\n',
    );
  });

  it("formats the date with zero padding", () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("LOGS_AS_FILE", () => {
  it("true: logs go to a file (with requestId support) and nothing goes to stdout", async () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const { logger, close, logsDir } = createAppLogger({ level: "info", logsAsFile: true, dir });
    logger.info({ itemId: 1 }, "to the file");
    await close();

    expect(logsDir).toBe(dir);
    const [file] = readdirSync(dir);
    expect(file).toMatch(/^\d{4}-\d{2}-\d{2}\.log$/);
    expect(JSON.parse(readFileSync(join(dir, file!), "utf8"))).toMatchObject({ msg: "to the file", itemId: 1 });
    expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes("to the file"))).toBe(false);
    stdout.mockRestore();
  });

  it("false: logs go to stdout and no files are created", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { logger, close, logsDir } = createAppLogger({ level: "info", logsAsFile: false, dir });
    logger.info("to stdout");
    await close();

    expect(logsDir).toBeUndefined();
    expect(readdirSync(dir)).toEqual([]);
    expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes("to stdout"))).toBe(true);
    stdout.mockRestore();
  });

  it("is read from the environment as a boolean, defaulting to false", () => {
    expect(loadConfig({}).LOGS_AS_FILE).toBe(false);
    expect(loadConfig({ LOGS_AS_FILE: "true" }).LOGS_AS_FILE).toBe(true);
    expect(loadConfig({ LOGS_AS_FILE: "false" }).LOGS_AS_FILE).toBe(false);
    expect(() => loadConfig({ LOGS_AS_FILE: "yes" })).toThrow();
  });
});
