import { NextRequest, NextResponse } from 'next/server';
import { studentLogout } from '@/lib/actions/student';

export async function POST(request: NextRequest) {
  await studentLogout();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/student/login`);
}
