import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function sendPaginated<T>(
  res:        Response,
  items:      T[],
  nextCursor: string | null,
  total:      number,
): void {
  res.status(200).json({ items, nextCursor, total });
}
