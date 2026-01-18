/**
 * Centralized constants for the web app
 * Avoids duplication across route files
 */

// CoStar extraction service URL (runs locally with 2FA)
export const COSTAR_SERVICE_URL =
  process.env.COSTAR_SERVICE_URL || "http://localhost:8765";
