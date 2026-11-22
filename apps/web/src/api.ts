import type { ApiError, CreateItem, Item, PaginatedResponse } from "./types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
  }
}

// Same-origin /api/*; next.config.ts forwards it to the Hono server.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiRequestError(res.status, (await res.json()) as ApiError);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  listItems: () => request<PaginatedResponse<Item>>("/items"),
  createItem: (input: CreateItem) =>
    request<Item>("/items", { method: "POST", body: JSON.stringify(input) }),
  deleteItem: (id: number) => request<void>(`/items/${id}`, { method: "DELETE" }),
};
