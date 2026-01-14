import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { config, updateConfigFromSettings } from './config.js';

const { Pool } = pg;

// Direct Postgres connection for pg-boss and raw queries
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

// Supabase client for API-style queries
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Helper for direct queries
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Load settings from database
export async function loadSettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .like('key', 'worker.%');

    if (error) {
      console.error('Failed to load settings:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const settingsMap: Record<string, string | number | boolean> = {};
      for (const { key, value } of data) {
        // Parse JSON values
        try {
          settingsMap[key] = JSON.parse(value);
        } catch {
          settingsMap[key] = value;
        }
      }
      updateConfigFromSettings(settingsMap);

      if (config.debug) {
        console.log('[db] Settings loaded:', settingsMap);
      }
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// Update worker status
export async function updateWorkerStatus(
  isRunning: boolean,
  additionalData?: Record<string, unknown>
): Promise<void> {
  const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown';
  const pid = process.pid;

  const { error } = await supabase
    .from('worker_status')
    .upsert({
      id: 'main',
      is_running: isRunning,
      hostname,
      pid,
      started_at: isRunning ? new Date().toISOString() : null,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...additionalData,
    });

  if (error) {
    console.error('Failed to update worker status:', error.message);
  }
}

// Send heartbeat
export async function sendHeartbeat(
  jobsProcessed?: number,
  jobsFailed?: number,
  currentJobId?: string | null
): Promise<void> {
  const updateData: Record<string, unknown> = {
    id: 'main',
    last_heartbeat: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (jobsProcessed !== undefined) {
    updateData.jobs_processed = jobsProcessed;
  }
  if (jobsFailed !== undefined) {
    updateData.jobs_failed = jobsFailed;
  }
  if (currentJobId !== undefined) {
    updateData.current_job_id = currentJobId;
  }

  const { error } = await supabase
    .from('worker_status')
    .upsert(updateData);

  if (error && config.debug) {
    console.error('Failed to send heartbeat:', error.message);
  }
}

// Check rate limits
export async function checkRateLimit(
  group = 'default'
): Promise<{
  canSend: boolean;
  hourlyCount: number;
  dailyCount: number;
  hourlyRemaining: number;
  dailyRemaining: number;
  reason: string;
}> {
  const result = await query<{
    can_send: boolean;
    hourly_count: number;
    daily_count: number;
    hourly_remaining: number;
    daily_remaining: number;
    reason: string;
  }>(`SELECT * FROM check_send_rate_limit($1, $2, $3)`, [
    group,
    config.rateLimits.hourly,
    config.rateLimits.daily,
  ]);

  if (result.rows.length === 0) {
    return {
      canSend: true,
      hourlyCount: 0,
      dailyCount: 0,
      hourlyRemaining: config.rateLimits.hourly,
      dailyRemaining: config.rateLimits.daily,
      reason: 'OK',
    };
  }

  const row = result.rows[0];
  return {
    canSend: row.can_send,
    hourlyCount: row.hourly_count,
    dailyCount: row.daily_count,
    hourlyRemaining: row.hourly_remaining,
    dailyRemaining: row.daily_remaining,
    reason: row.reason,
  };
}

// Increment send count
export async function incrementSendCount(group = 'default'): Promise<void> {
  await query('SELECT increment_send_count($1)', [group]);
}

// Cleanup on exit
export async function cleanup(): Promise<void> {
  await pool.end();
}
