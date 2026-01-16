import PgBoss from 'pg-boss';
import { config } from './config.js';
import {
  loadSettings,
  updateWorkerStatus,
  sendHeartbeat,
  cleanup,
} from './db.js';
import { createQueues, registerJobs, scheduleRecurringJobs } from './jobs/index.js';

let boss: PgBoss | null = null;
let jobsProcessed = 0;
let jobsFailed = 0;
let settingsInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

async function main() {
  console.log('========================================');
  console.log('  UPSTREAM pg-boss WORKER');
  console.log('========================================');
  console.log(`Database: ${config.databaseUrl.replace(/:[^@]+@/, ':***@')}`);
  console.log(`Scripts:  ${config.python.scriptsDir}`);

  // Load settings from database
  await loadSettings();
  console.log(`Debug:    ${config.debug}`);
  console.log(`Timezone: ${config.defaultTimezone}`);
  console.log(`Rate limits: ${config.rateLimits.hourly}/hr, ${config.rateLimits.daily}/day`);
  console.log('Jobs enabled:');
  console.log(`  - Email sync:      ${config.jobs.emailSync}`);
  console.log(`  - Process replies: ${config.jobs.processReplies}`);
  console.log(`  - Auto follow-up:  ${config.jobs.autoFollowUp}`);
  console.log(`  - Ghost detection: ${config.jobs.ghostDetection}`);
  console.log('Email sending:');
  console.log(`  - Campaign:  ${config.emailSending.campaign}`);
  console.log(`  - Manual:    ${config.emailSending.manual}`);
  console.log(`  - AI:        ${config.emailSending.ai}`);

  // Initialize pg-boss
  boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: config.pgBoss.schema,
    archiveCompletedAfterSeconds: config.pgBoss.archiveCompletedAfterSeconds,
    retentionDays: config.pgBoss.retentionDays,
  });

  boss.on('error', (error) => {
    console.error('[pg-boss] Error:', error);
    jobsFailed++;
  });

  // Start pg-boss
  await boss.start();
  console.log('[pg-boss] Started');

  // Create queues first (required in pg-boss 10.x)
  await createQueues(boss);

  // Register job handlers
  await registerJobs(boss, {
    onJobComplete: () => jobsProcessed++,
    onJobFail: () => jobsFailed++,
  });
  console.log('[jobs] Handlers registered');

  // Schedule recurring jobs
  await scheduleRecurringJobs(boss);
  console.log('[jobs] Recurring jobs scheduled');

  // Update worker status
  await updateWorkerStatus(true);
  console.log('[status] Worker marked as running');

  // Start heartbeat (every 30 seconds)
  heartbeatInterval = setInterval(async () => {
    await sendHeartbeat(jobsProcessed, jobsFailed, null);
  }, 30000);

  // Reload settings periodically (every 60 seconds)
  settingsInterval = setInterval(async () => {
    await loadSettings();
    if (config.debug) {
      console.log('[settings] Reloaded from database');
    }

    // Check if paused
    if (config.paused) {
      console.log('[worker] Paused - skipping job processing');
    }
  }, 60000);

  console.log('========================================');
  console.log('Worker running. Press Ctrl+C to stop.');
  console.log('========================================');
}

async function shutdown() {
  console.log('\n[shutdown] Shutting down...');

  if (settingsInterval) {
    clearInterval(settingsInterval);
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  await updateWorkerStatus(false, {
    jobs_processed: jobsProcessed,
    jobs_failed: jobsFailed,
  });

  if (boss) {
    await boss.stop({ graceful: true, timeout: 10000 });
  }

  await cleanup();
  console.log('[shutdown] Complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[fatal] Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled rejection:', reason);
  shutdown();
});

// Start the worker
main().catch((error) => {
  console.error('[fatal] Startup failed:', error);
  process.exit(1);
});
