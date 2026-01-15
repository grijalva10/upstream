import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

export interface WorkerConfig {
  // Database
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;

  // pg-boss settings
  pgBoss: {
    schema: string;
    archiveCompletedAfterSeconds: number;
    retentionDays: number;
  };

  // Rate limits (loaded from DB, these are defaults)
  rateLimits: {
    hourly: number;
    daily: number;
  };

  // Default timezone (loaded from DB)
  defaultTimezone: string;

  // Job intervals in seconds (loaded from DB)
  intervals: {
    emailSync: number;
    checkReplies: number;
    queueProcess: number;
  };

  // Python paths
  python: {
    executable: string;
    scriptsDir: string;
    projectRoot: string;
  };

  // CoStar service
  costarServiceUrl: string;

  // Feature flags
  dryRun: boolean;
  debug: boolean;
  paused: boolean;
  autoExecuteQueries: boolean;
}

export const config: WorkerConfig = {
  // Database
  databaseUrl: process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:55321',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY || '',

  // pg-boss settings
  pgBoss: {
    schema: 'pgboss',
    archiveCompletedAfterSeconds: 60 * 60 * 24, // 1 day
    retentionDays: 7,
  },

  // Rate limits (defaults, will be overridden from DB)
  rateLimits: {
    hourly: parseInt(process.env.RATE_LIMIT_HOURLY || '1000'),
    daily: parseInt(process.env.RATE_LIMIT_DAILY || '10000'),
  },

  // Default timezone
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles',

  // Job intervals in seconds (defaults, will be overridden from DB)
  intervals: {
    emailSync: 15 * 60,      // 15 minutes
    checkReplies: 5 * 60,    // 5 minutes
    queueProcess: 30,        // 30 seconds
  },

  // Python paths
  python: {
    executable: process.env.PYTHON_PATH || 'python',
    scriptsDir: resolve(__dirname, '../../../scripts'),
    projectRoot: resolve(__dirname, '../../..'),
  },

  // CoStar service
  costarServiceUrl: process.env.COSTAR_SERVICE_URL || 'http://localhost:8765',

  // Feature flags (defaults, will be overridden from DB)
  dryRun: process.env.DRY_RUN === 'true',
  debug: process.env.DEBUG === 'true',
  paused: false,
  autoExecuteQueries: false, // Don't auto-run CoStar queries after generating payloads
};

// Function to update config from database settings
export function updateConfigFromSettings(settings: Record<string, string | number | boolean>) {
  if (settings['worker.rate_limit_hourly'] !== undefined) {
    config.rateLimits.hourly = Number(settings['worker.rate_limit_hourly']);
  }
  if (settings['worker.rate_limit_daily'] !== undefined) {
    config.rateLimits.daily = Number(settings['worker.rate_limit_daily']);
  }
  if (settings['worker.default_timezone'] !== undefined) {
    config.defaultTimezone = String(settings['worker.default_timezone']).replace(/"/g, '');
  }
  if (settings['worker.interval_email_sync'] !== undefined) {
    config.intervals.emailSync = Number(settings['worker.interval_email_sync']) * 60;
  }
  if (settings['worker.interval_check_replies'] !== undefined) {
    config.intervals.checkReplies = Number(settings['worker.interval_check_replies']) * 60;
  }
  if (settings['worker.interval_queue_process'] !== undefined) {
    config.intervals.queueProcess = Number(settings['worker.interval_queue_process']);
  }
  if (settings['worker.dry_run'] !== undefined) {
    config.dryRun = settings['worker.dry_run'] === true || settings['worker.dry_run'] === 'true';
  }
  if (settings['worker.debug'] !== undefined) {
    config.debug = settings['worker.debug'] === true || settings['worker.debug'] === 'true';
  }
  if (settings['worker.paused'] !== undefined) {
    config.paused = settings['worker.paused'] === true || settings['worker.paused'] === 'true';
  }
}
