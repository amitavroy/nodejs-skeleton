import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type RequestContext = { requestId: string };

const storage = new AsyncLocalStorage<RequestContext>();

/** The X-Request-ID header if it is present and at most 128 chars, otherwise a new UUID. */
export function resolveRequestId(header: string | undefined): string {
  return header && header.length <= 128 ? header : randomUUID();
}

/** Runs fn with requestId available anywhere below it via getRequestId(). */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** The current request's ID, or undefined outside a request (startup, jobs without one). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
