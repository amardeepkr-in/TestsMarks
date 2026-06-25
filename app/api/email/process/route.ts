import { NextRequest, NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/services/email';
import { validateSession } from '@/lib/auth';

export async function POST() {
  try {
    // Verify admin authentication via session
    const user = await validateSession();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process email queue
    const result = await processEmailQueue(10);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing email queue:', error);
    return NextResponse.json(
      { error: 'Failed to process email queue' },
      { status: 500 }
    );
  }
}

// Allow GET for cron job services that don't support POST
export async function GET(request: NextRequest) {
  try {
    // Check for API key in query params or headers for cron jobs
    const apiKey = request.nextUrl.searchParams.get('key') ||
                   request.headers.get('x-api-key');

    const expectedKey = process.env.EMAIL_QUEUE_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process email queue
    const result = await processEmailQueue(10);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing email queue:', error);
    return NextResponse.json(
      { error: 'Failed to process email queue' },
      { status: 500 }
    );
  }
}


