import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/services/monitoring';

export async function GET() {
  try {
    const health = await healthCheck();

    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks: { server: false },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}


