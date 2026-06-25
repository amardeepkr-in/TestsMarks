import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { importFromFile, parseCSV, parseExcel } from '@/lib/services/import';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Check admin authentication
    await requirePermission(Permission.BULK_IMPORT);

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const preview = formData.get('preview') === 'true';
    const skipDuplicates = formData.get('skipDuplicates') === 'true';
    const updateExisting = formData.get('updateExisting') === 'true';
    const sendNotifications = formData.get('sendNotifications') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file size (5MB limit)
    const maxSize = parseInt(process.env.MAX_IMPORT_SIZE || '5242880'); // 5MB default
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // If preview mode, just parse and return data
    if (preview) {
      try {
        let records;
        if (file.name.endsWith('.csv')) {
          const content = buffer.toString('utf-8');
          records = parseCSV(content);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          records = await parseExcel(buffer);
        } else {
          return NextResponse.json(
            { error: 'Unsupported file type. Use CSV or Excel files.' },
            { status: 400 }
          );
        }

        return NextResponse.json({ preview: records.slice(0, 10) });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to parse file' },
          { status: 400 }
        );
      }
    }

    // Import data
    const summary = await importFromFile(buffer, file.name, {
      skipDuplicates,
      updateExisting,
      sendNotifications,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}


