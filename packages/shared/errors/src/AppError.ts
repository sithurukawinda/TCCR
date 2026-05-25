export class AppError extends Error {
  public readonly status:    number;
  public readonly errorCode: string;
  public readonly details?:  Record<string, string[]>;

  constructor(
    status:    number,
    errorCode: string,
    message:   string,
    details?:  Record<string, string[]>,
  ) {
    super(message);
    this.name      = 'AppError';
    this.status    = status;
    this.errorCode = errorCode;
    this.details   = details;
    Error.captureStackTrace(this, AppError);
  }
}

export function createHttpError(
  status:    number,
  errorCode: string,
  message:   string,
  details?:  Record<string, string[]>,
): AppError {
  return new AppError(status, errorCode, message, details);
}
