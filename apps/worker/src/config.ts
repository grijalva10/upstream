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

  // Job-specific enable/disable flags
  jobs: {
    emailSync: boolean;           // Sync emails from Outlook
    processReplies: boolean;      // Classify and act on replies
    autoFollowUp: boolean;        // Send automated follow-ups
    ghostDetection: boolean;      // Mark unresponsive contacts
  };

  // Email sending by type (granular control)
  emailSending: {
    campaign: boolean;            // Emails from drip campaigns/sequences
    manual: boolean;              // User-initiated emails
    ai: boolean;                  // AI-generated emails (follow-ups, responses)
  };

  // General flags
  debug: boolean;
  paused: boolean;
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

  // Job-specific enable/disable flags (defaults, will be overridden from DB)
  // All jobs enabled by default
  jobs: {
    emailSync: true,
    processReplies: true,
    autoFollowUp: true,
    ghostDetection: true,
  },

  // Email sending by type (defaults, will be overridden from DB)
  // All disabled by default for safety - must explicitly enable
  emailSending: {
    campaign: false,
    manual: false,
    ai: false,
  },

  // General flags
  debug: process.env.DEBUG === 'true',
  paused: false,
};

// Helper to parse boolean from DB value
function parseBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === true || value === 'true';
}

// Setting update mappings
type SettingUpdater = (value: unknown) => void;

const SETTING_UPDATERS: Record<string, SettingUpdater> = {
  // Rate limits
  'worker.rate_limit_hourly': (v) => { config.rateLimits.hourly = Number(v); },
  'worker.rate_limit_daily': (v) => { config.rateLimits.daily = Number(v); },

  // Timezone
  'worker.default_timezone': (v) => { config.defaultTimezone = String(v).replace(/"/g, ''); },

  // Intervals (minutes to seconds conversion for sync/replies)
  'worker.interval_email_sync': (v) => { config.intervals.emailSync = Number(v) * 60; },
  'worker.interval_check_replies': (v) => { config.intervals.checkReplies = Number(v) * 60; },
  'worker.interval_queue_process': (v) => { config.intervals.queueProcess = Number(v); },

  // Job toggles (default true)
  'worker.job.email_sync': (v) => { config.jobs.emailSync = parseBool(v, true); },
  'worker.job.process_replies': (v) => { config.jobs.processReplies = parseBool(v, true); },
  'worker.job.auto_follow_up': (v) => { config.jobs.autoFollowUp = parseBool(v, true); },
  'worker.job.ghost_detection': (v) => { config.jobs.ghostDetection = parseBool(v, true); },

  // Email sending by type (default false for safety)
  'worker.email.campaign': (v) => { config.emailSending.campaign = parseBool(v, false); },
  'worker.email.manual': (v) => { config.emailSending.manual = parseBool(v, false); },
  'worker.email.ai': (v) => { config.emailSending.ai = parseBool(v, false); },

  // General flags
  'worker.debug': (v) => { config.debug = parseBool(v, false); },
  'worker.paused': (v) => { config.paused = parseBool(v, false); },
};

// Function to update config from database settings
export function updateConfigFromSettings(settings: Record<string, string | number | boolean>): void {
  // Apply all known settings
  for (const [key, updater] of Object.entries(SETTING_UPDATERS)) {
    if (settings[key] !== undefined) {
      updater(settings[key]);
    }
  }

  // Legacy: Map old dry_run to email sending settings if new settings not present
  if (settings['worker.dry_run'] !== undefined &&
      settings['worker.email.campaign'] === undefined &&
      settings['worker.email.manual'] === undefined &&
      settings['worker.email.ai'] === undefined) {
    const sendingEnabled = !parseBool(settings['worker.dry_run'], true);
    config.emailSending.campaign = sendingEnabled;
    config.emailSending.manual = sendingEnabled;
    config.emailSending.ai = sendingEnabled;
  }
}
