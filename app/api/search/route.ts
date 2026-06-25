import { NextRequest, NextResponse } from 'next/server';
import { advancedSearch, initializeFTS5 } from '@/lib/services/search';
import { get, set, CacheKeys } from '@/lib/services/cache';
import { trackApiRequest } from '@/lib/services/monitoring';
import { info } from '@/lib/services/logger';

// Initialize FTS5 on first load
let ftsInitialized = false;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Initialize FTS5 if not already done
    if (!ftsInitialized) {
      await initializeFTS5();
      ftsInitialized = true;
    }

    const filters = await request.json();

    // Create cache key from filters
    const cacheKey = CacheKeys.searchResults(
      JSON.stringify(filters),
      filters.offset || 0
    );

    // Try to get from cache
    const cached = await get(cacheKey);
    if (cached) {
      info('Search results served from cache', { filters });
      const duration = Date.now() - startTime;
      trackApiRequest('/api/search', 'POST', duration, 200);

      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Perform search
    const result = await advancedSearch(filters);

    // Cache results for 5 minutes
    await set(cacheKey, result, 300);

    info('Search completed', {
      filters,
      resultCount: result.results.length,
      total: result.total
    });

    const duration = Date.now() - startTime;
    trackApiRequest('/api/search', 'POST', duration, 200);

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('Search error:', error);

    const duration = Date.now() - startTime;
    trackApiRequest('/api/search', 'POST', duration, 500);

    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}


