/** Services throw these; the global error handler turns them into responses. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: 400 | 401 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} not found`, 404);
  }
}
