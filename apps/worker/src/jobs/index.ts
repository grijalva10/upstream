/**
 * Job Registry and Scheduling
 *
 * Autonomous Email Handling Pipeline:
 * 1. email-sync: Pull emails from Outlook (every 5 min)
 * 2. process-replies: Classify + act on inbound emails (every 2 min)
 * 3. auto-follow-up: Send follow-ups for pending docs/OOO (daily)
 * 4. ghost-detection: Mark unresponsive contacts (daily)
 *
 * Outreach Pipeline:
 * 1. process-queue: Dequeue emails from email_queue (every minute)
 * 2. send-email: Actually send via Outlook
 *
 * Sourcing Pipeline:
 * 1. generate-queries: Run sourcing agent for CoStar payloads
 */

import PgBoss from 'pg-boss';
import { config } from '../config.js';
import { handleEmailSync } from './email-sync.job.js';
import { handleSendEmail } from './send-email.job.js';
import { createProcessQueueHandler } from './process-queue.job.js';
import { handleGenerateQueries } from './generate-queries.job.js';
import { createProcessRepliesHandler } from './process-replies.job.js';
import { createAutoFollowUpHandler } from './auto-follow-up.job.js';
import { handleGhostDetection } from './ghost-detection.job.js';
import { handleReconcileLeadStatus } from './reconcile-lead-status.job.js';

const QUEUES = [
  // Core queues
  'email-sync',
  'process-replies',
  'process-queue',
  'send-email',
  'generate-queries',
  // Autonomous operations
  'auto-follow-up',
  'ghost-detection',
  // Data reconciliation (on-demand + scheduled)
  'reconcile-lead-status',
];

interface JobCallbacks {
  onJobComplete: () => void;
  onJobFail: () => void;
}

export async function createQueues(boss: PgBoss) {
  for (const queue of QUEUES) {
    await boss.createQueue(queue);
  }
  console.log(`[jobs] Created ${QUEUES.length} queues`);
}

export async function registerJobs(boss: PgBoss, callbacks: JobCallbacks) {
  // Wrap handlers to track completions/failures
  const wrapHandler = <T>(
    name: string,
    handler: (job: PgBoss.Job<T>) => Promise<unknown>
  ) => {
    return async (job: PgBoss.Job<T>) => {
      if (config.paused) {
        console.log(`[${name}] Skipped - worker paused`);
        return;
      }

      const start = Date.now();
      try {
        if (config.debug) {
          console.log(`[${name}] Starting job ${job.id}`);
        }

        const result = await handler(job);
        callbacks.onJobComplete();

        if (config.debug) {
          console.log(`[${name}] Completed in ${Date.now() - start}ms`);
        }

        return result;
      } catch (error) {
        callbacks.onJobFail();
        console.error(`[${name}] Failed after ${Date.now() - start}ms:`, error);
        throw error;
      }
    };
  };

  // ==========================================================================
  // CORE JOBS
  // ==========================================================================

  // Email sync from Outlook (scheduled)
  await boss.work(
    'email-sync',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('email-sync', handleEmailSync)
  );

  // Unified reply processing - classifies AND takes action (scheduled)
  const processRepliesHandler = createProcessRepliesHandler(boss);
  await boss.work(
    'process-replies',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('process-replies', processRepliesHandler)
  );

  // Queue processing for outbound emails (scheduled)
  const processQueueHandler = createProcessQueueHandler(boss);
  await boss.work(
    'process-queue',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('process-queue', processQueueHandler)
  );

  // Individual email sends (triggered by process-queue)
  await boss.work(
    'send-email',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('send-email', handleSendEmail)
  );

  // Generate queries from buyer criteria (triggered by new search or buyer inquiry)
  await boss.work(
    'generate-queries',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('generate-queries', handleGenerateQueries)
  );

  // ==========================================================================
  // AUTONOMOUS OPERATIONS
  // ==========================================================================

  // Auto follow-up for pending docs and OOO returns (scheduled daily)
  const autoFollowUpHandler = createAutoFollowUpHandler(boss);
  await boss.work(
    'auto-follow-up',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('auto-follow-up', autoFollowUpHandler)
  );

  // Ghost detection for unresponsive contacts (scheduled daily)
  await boss.work(
    'ghost-detection',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('ghost-detection', handleGhostDetection)
  );

  // ==========================================================================
  // DATA RECONCILIATION
  // ==========================================================================

  // Reconcile lead statuses from email activity (scheduled weekly + on-demand)
  await boss.work(
    'reconcile-lead-status',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('reconcile-lead-status', handleReconcileLeadStatus)
  );

  console.log('[jobs] Registered all job handlers');
}

export async function scheduleRecurringJobs(boss: PgBoss) {
  console.log('[jobs] Scheduling recurring jobs...');

  // ==========================================================================
  // FREQUENT JOBS
  // ==========================================================================

  // Process outbound email queue - every minute
  await boss.schedule('process-queue', '* * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - process-queue: every minute');

  // Email sync from Outlook - every 5 minutes
  await boss.schedule('email-sync', '*/5 * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - email-sync: every 5 minutes');

  // Process inbound replies (classify + act) - every 2 minutes
  await boss.schedule('process-replies', '*/2 * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - process-replies: every 2 minutes');

  // ==========================================================================
  // DAILY JOBS (run at 9 AM local time)
  // ==========================================================================

  // Auto follow-up for pending docs - daily at 9 AM
  await boss.schedule('auto-follow-up', '0 9 * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - auto-follow-up: daily at 9 AM');

  // Ghost detection - daily at 9:30 AM
  await boss.schedule('ghost-detection', '30 9 * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - ghost-detection: daily at 9:30 AM');

  // ==========================================================================
  // WEEKLY JOBS (run Sunday morning)
  // ==========================================================================

  // Reconcile lead statuses - weekly on Sunday at 6 AM
  await boss.schedule('reconcile-lead-status', '0 6 * * 0', undefined, {
    tz: config.defaultTimezone,
  });
  console.log('  - reconcile-lead-status: weekly Sunday 6 AM');

  console.log('[jobs] Recurring jobs scheduled');
}
