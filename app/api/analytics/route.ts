import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsData } from '@/lib/services/analytics';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Check admin authentication
    await requirePermission(Permission.VIEW_ANALYTICS);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const category = searchParams.get('category') || undefined;

    // Get analytics data
    const analyticsData = getAnalyticsData(startDate, endDate, category);

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}


