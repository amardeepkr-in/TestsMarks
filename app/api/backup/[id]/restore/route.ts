import { NextRequest, NextResponse } from 'next/server';
import { restoreBackup } from '@/lib/services/backup';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await requirePermission(Permission.MANAGE_BACKUPS);
    const { id } = await params;
    const backupId = parseInt(id);

    if (isNaN(backupId)) {
      return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
    }

    await restoreBackup(backupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Backup restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup' },
      { status: 500 }
    );
  }
}


