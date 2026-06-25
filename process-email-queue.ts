#!/usr/bin/env node

/**
 * Email Queue Processor Script
 *
 * This script processes pending emails from the email queue.
 * Can be run manually or scheduled as a cron job.
 *
 * Usage:
 *   node scripts/process-email-queue.js
 *
 * Or with npm:
 *   npm run process-emails
 *
 * Cron example (every 5 minutes):
 *   Star-slash-5 star star star star cd /path/to/project and-and npm run process-emails
 */

import { processEmailQueue } from '../lib/services/email';

async function main() {
  console.log(`[${new Date().toISOString()}] Starting email queue processing...`);

  try {
    const result = await processEmailQueue(10); // Process up to 10 emails

    console.log(`[${new Date().toISOString()}] Email queue processing completed:`);
    console.log(`  - Processed: ${result.processed}`);
    console.log(`  - Succeeded: ${result.succeeded}`);
    console.log(`  - Failed: ${result.failed}`);

    if (result.failed > 0) {
      console.warn(`[${new Date().toISOString()}] Warning: ${result.failed} emails failed to send`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing email queue:`, error);
    process.exit(1);
  }
}

main();


