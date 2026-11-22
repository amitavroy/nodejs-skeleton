import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join } from "node:path";

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the server's local time zone (the date a human would expect on the file). */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DailyFileStream = {
  write(chunk: string): void;
  /** Flushes and closes the current file. Call on shutdown. */
  close(): Promise<void>;
};

/**
 * A log destination that appends to `<dir>/YYYY-MM-DD.log` and switches to a new file
 * when the date changes. Existing files are appended to, so a restart keeps the day's file.
 * Old files are never deleted: clean them up with a cron job or logrotate if needed.
 */
export function createDailyFileStream(dir: string, now: () => Date = () => new Date()): DailyFileStream {
  mkdirSync(dir, { recursive: true });
  let currentDay = "";
  let stream: WriteStream | undefined;

  return {
    write(chunk) {
      const day = formatLocalDate(now());
      if (day !== currentDay || !stream) {
        stream?.end();
        stream = createWriteStream(join(dir, `${day}.log`), { flags: "a" });
        stream.on("error", (err) => process.stderr.write(`log file error: ${err.message}\n`));
        currentDay = day;
      }
      stream.write(chunk);
    },
    close() {
      return new Promise((resolve) => (stream ? stream.end(resolve) : resolve()));
    },
  };
}
