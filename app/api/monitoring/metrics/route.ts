import { NextResponse } from 'next/server';
import { getSystemMetrics } from '@/lib/services/monitoring';
import { validateSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await validateSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = await getSystemMetrics();

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Get metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to get metrics' },
      { status: 500 }
    );
  }
}


