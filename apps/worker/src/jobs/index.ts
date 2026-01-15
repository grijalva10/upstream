import PgBoss from 'pg-boss';
import { config } from '../config.js';
import { handleEmailSync } from './email-sync.job.js';
import { handleCheckReplies } from './check-replies.job.js';
import { handleSendEmail } from './send-email.job.js';
import { handleClassify } from './classify.job.js';
import { handleProcessQueue } from './process-queue.job.js';
import { handleCoStarQuery } from './costar-query.job.js';
import { handleGenerateQueries } from './generate-queries.job.js';

const QUEUES = [
  'email-sync',
  'check-replies',
  'process-queue',
  'send-email',
  'classify-email',
  'costar-query',
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

  // Scheduled jobs (run on cron)
  await boss.work(
    'email-sync',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('email-sync', handleEmailSync)
  );

  await boss.work(
    'check-replies',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('check-replies', handleCheckReplies)
  );

  // Queue processing (runs frequently)
  await boss.work(
    'process-queue',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('process-queue', handleProcessQueue)
  );

  // Individual email sends (triggered by process-queue)
  await boss.work(
    'send-email',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('send-email', handleSendEmail)
  );

  // Email classification (triggered by check-replies)
  await boss.work(
    'classify-email',
    { teamSize: 2, teamConcurrency: 2 },
    wrapHandler('classify-email', handleClassify)
  );

  // CoStar queries (triggered by criteria approval or manual)
  // Only 1 concurrent - CoStar is rate-sensitive
  await boss.work(
    'costar-query',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('costar-query', handleCoStarQuery)
  );

  // Generate queries from buyer criteria (triggered by new search)
  await boss.work(
    'generate-queries',
    { teamSize: 1, teamConcurrency: 1 },
    wrapHandler('generate-queries', (job) => handleGenerateQueries(job, boss))
  );
}

export async function scheduleRecurringJobs(boss: PgBoss) {
  // Convert intervals to cron expressions
  const emailSyncMinutes = Math.floor(config.intervals.emailSync / 60);
  const checkRepliesMinutes = Math.floor(config.intervals.checkReplies / 60);
  const processQueueSeconds = config.intervals.queueProcess;

  // Email sync - every N minutes
  await boss.schedule('email-sync', `*/${emailSyncMinutes} * * * *`, undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - email-sync: every ${emailSyncMinutes} minutes`);

  // Check replies - every N minutes
  await boss.schedule('check-replies', `*/${checkRepliesMinutes} * * * *`, undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - check-replies: every ${checkRepliesMinutes} minutes`);

  // Process queue - pg-boss cron only supports minutes, so we use a workaround
  // Schedule every minute, the handler will check more frequently
  await boss.schedule('process-queue', '* * * * *', undefined, {
    tz: config.defaultTimezone,
  });
  console.log(`  - process-queue: every minute (internal: ${processQueueSeconds}s)`);
}
