import { NextResponse } from 'next/server';
import { getStats } from '@/lib/services/cache';
import { validateSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await validateSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getStats();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}


