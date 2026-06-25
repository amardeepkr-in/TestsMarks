import { NextRequest, NextResponse } from 'next/server';
import { createBackup, listBackups } from '@/lib/services/backup';
import { requirePermission } from '@/lib/auth';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';
import { Permission } from '@/lib/services/rbac';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await requirePermission(Permission.MANAGE_BACKUPS);
    const backups = listBackups();
    return NextResponse.json(backups);
  } catch (error) {
    console.error('Backup list error:', error);
    return NextResponse.json(
      { error: 'Failed to list backups' },
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

    await requirePermission(Permission.MANAGE_BACKUPS);
    const backup = await createBackup('admin');
    return NextResponse.json(backup);
  } catch (error) {
    console.error('Backup creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}


