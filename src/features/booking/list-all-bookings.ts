import type { Booking, Page } from '@/api/schemas';

type FetchBookingPage = (page?: number, signal?: AbortSignal) => Promise<Page<Booking>>;

// Stop malformed pagination metadata from triggering unbounded requests.
const MAX_PAGES = 100;

/** Load a complete booking history for use in session lists and lifetime statistics. */
export async function listAllBookings(fetchPage: FetchBookingPage, signal?: AbortSignal): Promise<Page<Booking>> {
  const items: Booking[] = [];
  const seenIds = new Set<string>();
  const seenPages = new Set<number>();
  let nextPage: number | null = 1;

  while (nextPage !== null) {
    if (signal?.aborted) throw new Error('Booking history request cancelled');
    if (seenPages.has(nextPage) || seenPages.size >= MAX_PAGES) {
      throw new Error('Invalid booking pagination: repeated page or page limit exceeded');
    }

    seenPages.add(nextPage);
    const response = await fetchPage(nextPage, signal);
    if (signal?.aborted) throw new Error('Booking history request cancelled');

    for (const booking of response.items) {
      if (!seenIds.has(booking.id)) {
        seenIds.add(booking.id);
        items.push(booking);
      }
    }
    nextPage = response.nextPage;
  }

  return { items, nextPage: null };
}
