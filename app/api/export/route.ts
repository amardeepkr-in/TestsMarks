import { NextResponse } from 'next/server';
import { exportSubmissionsCSV } from '../../../lib/actions';

export async function GET() {
  try {
    const csv = await exportSubmissionsCSV();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="submissions-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}

