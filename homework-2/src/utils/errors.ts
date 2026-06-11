export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly details: Array<{ field: string; message: string }>,
  ) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class ParseError extends AppError {
  constructor(message: string) {
    super('PARSE_ERROR', message, 400);
    this.name = 'ParseError';
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(format: string) {
    super('UNSUPPORTED_MEDIA_TYPE', `Unsupported file format: ${format}`, 415);
    this.name = 'UnsupportedMediaError';
  }
}
