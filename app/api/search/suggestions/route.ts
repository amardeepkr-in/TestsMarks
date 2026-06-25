import { NextRequest, NextResponse } from 'next/server';
import { searchSuggestions } from '@/lib/services/search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = await searchSuggestions(query);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}


