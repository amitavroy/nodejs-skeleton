// API types used by the web app. Hand-written to mirror the API's responses
// (apps/server); the two apps share no code, so keep these in sync by hand.

export type Item = { id: number; name: string; createdAt: string };
export type CreateItem = { name: string };

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Every error response from the API has this shape. */
export type ApiError = {
  code: string;
  message: string;
  details?: { path: string; message: string }[];
  requestId: string;
};
