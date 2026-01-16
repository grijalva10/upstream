import PgBoss from 'pg-boss';
import { config } from '../config.js';
import { handleEmailSync } from './email-sync.job.js';
import { createCheckRepliesHandler } from './check-replies.job.js';
import { handleSendEmail } from './send-email.job.js';
import { handleClassify } from './classify.job.js';
import { createProcessQueueHandler } from './process-queue.job.js';
import { handleGenerateQueries } from './generate-queries.job.js';

const QUEUES = [
  'email-sync',
  'check-replies',
  'process-queue',
  'send-email',
  'classify-email',
  'generate-queries',
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

  // Queue processing (runs frequently)
  // Use factory to inject boss instance for queueing send jobs
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

  // Generate queries from buyer criteria (triggered by new search)
  await boss.work(
    'generate-queries',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('generate-queries', handleGenerateQueries)
  );

  // Email sync from Outlook (scheduled)
  await boss.work(
    'email-sync',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('email-sync', handleEmailSync)
  );

  // Check for unclassified replies (scheduled)
  const checkRepliesHandler = createCheckRepliesHandler(boss);
  await boss.work(
    'check-replies',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('check-replies', checkRepliesHandler)
  );

  // Classify individual emails (triggered by check-replies)
  await boss.work(
    'classify-email',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('classify-email', handleClassify)
  );
}

export async function scheduleRecurringJobs(boss: PgBoss) {
  // Process queue - every minute
  await boss.schedule('process-queue', '* * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - process-queue: every minute`);

  // Email sync from Outlook - every 5 minutes
  await boss.schedule('email-sync', '*/5 * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - email-sync: every 5 minutes`);

  // Check for unclassified replies - every 2 minutes
  await boss.schedule('check-replies', '*/2 * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - check-replies: every 2 minutes`);
}
