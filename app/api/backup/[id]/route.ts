import { NextRequest, NextResponse } from 'next/server';
import { deleteBackup } from '@/lib/services/backup';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function DELETE(
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

    deleteBackup(backupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Backup deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete backup' },
      { status: 500 }
    );
  }
}


