import { sendSuccess, sendPaginated } from '../../src/index';
import { Response } from 'express';

function makeRes(): Response & { _status: number; _body: unknown } {
  const res: any = {};
  res._body      = undefined;
  const json     = jest.fn((body: unknown) => { res._body = body; return res; });
  const status   = jest.fn((code: number) => { res._status = code; return { json }; });
  res.status     = status;
  res.json       = json;
  return res;
}

describe('sendSuccess()', () => {
  it('responds with status 200 by default', () => {
    const res = makeRes();
    sendSuccess(res, { id: '1', name: 'Test' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responds with a custom status when provided', () => {
    const res = makeRes();
    sendSuccess(res, { id: '1' }, 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sends the data as JSON body', () => {
    const res    = makeRes();
    const data   = { id: 'abc', title: 'Course' };
    sendSuccess(res, data);
    const json = (res.status as jest.Mock).mock.results[0].value.json;
    expect(json).toHaveBeenCalledWith(data);
  });

  it('works with null data (204-style bodies)', () => {
    const res = makeRes();
    sendSuccess(res, null, 204);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('sendPaginated()', () => {
  it('responds with status 200', () => {
    const res = makeRes();
    sendPaginated(res, [], null, 0);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sends items, nextCursor, and total in the body', () => {
    const res     = makeRes();
    const items   = [{ id: '1' }, { id: '2' }];
    sendPaginated(res, items, 'cursor-abc', 42);
    const json = (res.status as jest.Mock).mock.results[0].value.json;
    expect(json).toHaveBeenCalledWith({
      items,
      nextCursor: 'cursor-abc',
      total:      42,
    });
  });

  it('sends null nextCursor when on the last page', () => {
    const res = makeRes();
    sendPaginated(res, [{ id: '1' }], null, 1);
    const json = (res.status as jest.Mock).mock.results[0].value.json;
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ nextCursor: null }),
    );
  });

  it('sends an empty items array with total 0', () => {
    const res = makeRes();
    sendPaginated(res, [], null, 0);
    const json = (res.status as jest.Mock).mock.results[0].value.json;
    expect(json).toHaveBeenCalledWith({ items: [], nextCursor: null, total: 0 });
  });
});
