import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { exportToExcel, ExportStats } from '@/lib/services/export';
import type { Submission } from '@/lib/types';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/services/rbac';
import { apiRateLimit, checkRateLimit, getClientIp } from '@/lib/middleware/ratelimit';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(apiRateLimit, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await requirePermission(Permission.EXPORT_EXCEL);
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const ids = searchParams.get('ids');

    // Build query
    let query = 'SELECT * FROM submissions WHERE 1=1';
    const params: (string | number)[] = [];

    if (ids) {
      const idList = ids.split(',').map(id => parseInt(id));
      query += ` AND id IN (${idList.map(() => '?').join(',')})`;
      params.push(...idList);
    } else {
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
    }

    query += ' ORDER BY created_at DESC';

    // Get submissions
    const submissions = db.prepare(query).all(...params) as Submission[];

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 400 });
    }

    // Calculate statistics
    const marks = submissions.map(s => parseFloat(s.marks));
    const stats: ExportStats = {
      total: submissions.length,
      avgMarks: marks.reduce((a, b) => a + b, 0) / marks.length,
      highestMarks: Math.max(...marks),
      lowestMarks: Math.min(...marks),
      passRate: (marks.filter(m => m >= 40).length / marks.length) * 100,
    };

    // Generate Excel file
    const buffer = await exportToExcel(submissions, stats);

    // Return file
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="submissions-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: 'Failed to export to Excel' },
      { status: 500 }
    );
  }
}


