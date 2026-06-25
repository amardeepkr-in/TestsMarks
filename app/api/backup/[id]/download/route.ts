import { NextRequest, NextResponse } from 'next/server';
import { getBackupFilePath } from '@/lib/services/backup';
import fs from 'fs';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function GET(
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

    const filepath = getBackupFilePath(backupId);

    if (!filepath) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filepath);
    const filename = filepath.split('/').pop() || 'backup.json';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backup download error:', error);
    return NextResponse.json(
      { error: 'Failed to download backup' },
      { status: 500 }
    );
  }
}


