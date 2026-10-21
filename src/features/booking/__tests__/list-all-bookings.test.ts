import type { Booking, Page } from '@/api/schemas';

import { listAllBookings } from '../list-all-bookings';

function bookingPage(ids: string[], nextPage: number | null): Page<Booking> {
  return {
    items: ids.map((id) => ({ id }) as Booking),
    nextPage,
  };
}

describe('listAllBookings', () => {
  it('loads all pages instead of silently dropping older bookings', async () => {
    const fetchPage = jest.fn(async (page?: number) =>
      page === 1 ? bookingPage(['new-1', 'new-2'], 2) : bookingPage(['old-3'], null),
    );

    const result = await listAllBookings(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, undefined);
    expect(result.items.map((b) => b.id)).toEqual(['new-1', 'new-2', 'old-3']);
    expect(result.nextPage).toBeNull();
  });

  it('avoids duplicate bookings when an entry appears on overlapping pages', async () => {
    const fetchPage = jest.fn(async (page?: number) =>
      page === 1 ? bookingPage(['b1', 'b2'], 2) : bookingPage(['b2', 'b3'], null),
    );

    const result = await listAllBookings(fetchPage);
    expect(result.items.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('rejects repeated nextPage values instead of looping forever', async () => {
    const fetchPage = jest.fn(async () => bookingPage(['b1'], 1));

    await expect(listAllBookings(fetchPage)).rejects.toThrow(/Invalid booking pagination/);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('propagates server failures instead of showing incomplete history', async () => {
    const fetchPage = jest
      .fn<Promise<Page<Booking>>, [number | undefined]>()
      .mockResolvedValueOnce(bookingPage(['b1'], 2))
      .mockRejectedValueOnce(new Error('Network unavailable'));

    await expect(listAllBookings(fetchPage)).rejects.toThrow('Network unavailable');
  });

  it('forwards the cancellation signal and stops when cancelled', async () => {
    const controller = new AbortController();
    const fetchPage = jest.fn(async (_page?: number, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      controller.abort();
      return bookingPage(['b1'], 2);
    });

    await expect(listAllBookings(fetchPage, controller.signal)).rejects.toThrow(/cancelled/);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
