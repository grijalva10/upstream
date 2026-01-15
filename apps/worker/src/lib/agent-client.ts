/**
 * HTTP client for the Claude Agent Service.
 *
 * Communicates with the Python-based agent service (orchestrator/service.py)
 * to run Claude Code agents in headless mode.
 */

import { config } from "../config.js";

export interface AgentRunOptions {
  /** Agent name (maps to .claude/agents/{name}.md) */
  agent: string;
  /** The task prompt to send to the agent */
  prompt: string;
  /** Optional context for feedback lookup */
  context?: Record<string, unknown>;
  /** Session ID to resume a previous conversation */
  sessionId?: string;
  /** Maximum agent turns (default: 10) */
  maxTurns?: number;
  /** Allowed tools for the agent */
  allowedTools?: string[];
  /** Request timeout in milliseconds (default: 300000 = 5 min) */
  timeout?: number;
}

export interface AgentResult {
  /** Whether the agent completed successfully */
  success: boolean;
  /** The agent's output text */
  output: string;
  /** Session ID for resume (if multi-turn) */
  sessionId?: string;
  /** Execution ID for logging/tracking */
  executionId?: string;
  /** Error message if failed */
  error?: string;
}

export interface AgentServiceStatus {
  status: string;
  claude_path: string;
  agents_dir: string;
  available_agents: string[];
  dry_run: boolean;
}

/**
 * Client for the Claude Agent HTTP Service.
 */
export class AgentClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.agentServiceUrl;
  }

  /**
   * Check if the agent service is running and get status info.
   */
  async status(): Promise<AgentServiceStatus> {
    const res = await fetch(`${this.baseUrl}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Agent service status check failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Check if the agent service is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await this.status();
      return status.status === "running";
    } catch {
      return false;
    }
  }

  /**
   * Run any agent with the given options.
   */
  async run(options: AgentRunOptions): Promise<AgentResult> {
    const timeout = options.timeout || 300000; // 5 min default
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: options.agent,
          prompt: options.prompt,
          context: options.context,
          session_id: options.sessionId,
          max_turns: options.maxTurns,
          allowed_tools: options.allowedTools,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          output: "",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          output: "",
          error: `Request timed out after ${timeout / 1000}s`,
        };
      }
      return {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Run the sourcing agent with buyer criteria.
   */
  async runSourcing(
    criteria: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    const timeout = 300000; // 5 min
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/sourcing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria, context }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          output: "",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          output: "",
          error: `Sourcing agent timed out after ${timeout / 1000}s`,
        };
      }
      return {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Run the response classifier on an email.
   */
  async runClassifier(
    email: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    const timeout = 120000; // 2 min
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          output: "",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          output: "",
          error: `Classifier timed out after ${timeout / 1000}s`,
        };
      }
      return {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Run the qualify agent on a classified response.
   */
  async runQualify(
    classification: Record<string, unknown>,
    qualificationData?: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    const timeout = 180000; // 3 min
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classification,
          qualification_data: qualificationData,
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          output: "",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          output: "",
          error: `Qualify agent timed out after ${timeout / 1000}s`,
        };
      }
      return {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Run the deal packager on qualified data.
   */
  async runDealPackager(
    qualificationData: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    const timeout = 180000; // 3 min
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.baseUrl}/package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualification_data: qualificationData,
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          output: "",
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }

      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          output: "",
          error: `Deal packager timed out after ${timeout / 1000}s`,
        };
      }
      return {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// Singleton instance
let _client: AgentClient | null = null;

/**
 * Get the global agent client instance.
 */
export function getAgentClient(): AgentClient {
  if (!_client) {
    _client = new AgentClient();
  }
  return _client;
}
