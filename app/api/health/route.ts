import { NextResponse } from 'next/server';
import { getSubmissionCount, getSettings } from '../../../lib/actions';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connectivity
    db.prepare('SELECT 1').get();

    const count = await getSubmissionCount();
    const settings = await getSettings();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      submissions: count,
      database: 'connected',
      features: {
        submissions: settings?.allow_submissions === 1,
        uploads: settings?.allow_uploads === 1,
        edits: settings?.allow_user_edits === 1,
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Database connection failed',
        database: 'disconnected',
      },
      { status: 500 }
    );
  }
}
