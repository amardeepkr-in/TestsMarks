import { NextRequest, NextResponse } from 'next/server';
import { getFilters, saveFilter, deleteFilter, setDefaultFilter, updateFilter } from '@/lib/services/filters';
import { requireAuth, requirePermission } from '@/lib/auth';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';
import { Permission } from '@/lib/services/rbac';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await requireAuth();
    const filters = await getFilters(user.id);
    return NextResponse.json({ filters });
  } catch (error) {
    console.error('Get filters error:', error);
    return NextResponse.json(
      { error: 'Failed to get filters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await requirePermission(Permission.MANAGE_FILTERS);
    const { name, config, isDefault } = await request.json();

    if (!name || !config) {
      return NextResponse.json(
        { error: 'Name and config are required' },
        { status: 400 }
      );
    }

    const filter = await saveFilter(user.id, name, config, isDefault || false);
    return NextResponse.json({ filter });
  } catch (error) {
    console.error('Save filter error:', error);
    return NextResponse.json(
      { error: 'Failed to save filter' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await requirePermission(Permission.MANAGE_FILTERS);
    const { filterId, name, config, setAsDefault } = await request.json();

    if (!filterId) {
      return NextResponse.json(
        { error: 'Filter ID is required' },
        { status: 400 }
      );
    }

    if (setAsDefault) {
      await setDefaultFilter(user.id, filterId);
    } else if (name && config) {
      await updateFilter(filterId, name, config);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update filter error:', error);
    return NextResponse.json(
      { error: 'Failed to update filter' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await requirePermission(Permission.MANAGE_FILTERS);
    const searchParams = request.nextUrl.searchParams;
    const filterId = searchParams.get('id');

    if (!filterId) {
      return NextResponse.json(
        { error: 'Filter ID is required' },
        { status: 400 }
      );
    }

    await deleteFilter(parseInt(filterId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete filter error:', error);
    return NextResponse.json(
      { error: 'Failed to delete filter' },
      { status: 500 }
    );
  }
}


