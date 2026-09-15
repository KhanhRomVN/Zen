/**
 * ------------------------------------------------------------------
 * JWT Utilities
 * ------------------------------------------------------------------
 * Client-side JWT utilities for parsing and displaying expiry information.
 * ------------------------------------------------------------------
 */

/**
 * Extract JWT expiry timestamp from token
 * @param jwt - JWT token string
 * @returns Expiry timestamp (milliseconds since epoch) or null if invalid
 */
export function getJwtExpiry(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) {
      return null;
    }

    // Decode base64url
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );

    return typeof payload.exp === "number" ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch (e) {
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param jwt - JWT token string
 * @returns true if token is expired
 */
export function isJwtExpired(jwt: string): boolean {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return false;
  return Date.now() >= exp;
}

/**
 * Get time remaining until JWT expiry
 * @param jwt - JWT token string
 * @returns Milliseconds until expiry, or null if invalid token
 */
export function getJwtTimeToExpiry(jwt: string): number | null {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return null;
  return Math.max(0, exp - Date.now());
}

/**
 * Format expiry date as countdown (days and hours remaining)
 * @param jwt - JWT token string
 * @returns Formatted countdown string or null if invalid
 * Examples: "3d 5h", "12h", "45m", "Expired"
 */
export function formatJwtExpiry(jwt: string): string | null {
  const exp = getJwtExpiry(jwt);
  if (exp === null) return null;

  const now = Date.now();
  const diff = exp - now;

  // If expired
  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  // If less than 1 hour, show minutes
  if (hours === 0) {
    return `${minutes}m`;
  }

  // If less than 1 day, show hours only
  if (days === 0) {
    return `${hours}h`;
  }

  // Otherwise show days and remaining hours
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

/**
 * Extract access token from credential (supports both raw JWT and JSON format)
 * @param credential - Credential string (JWT or JSON)
 * @returns JWT token or null
 */
export function extractAccessToken(credential: string): string | null {
  if (!credential) return null;

  // Try parsing as JSON first
  if (credential.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(credential);
      const token =
        parsed.accessToken ||
        parsed.access_token ||
        parsed.token ||
        parsed.secretKey ||
        parsed.secret_key ||
        null;
      return token;
    } catch {
      // Not valid JSON, continue
    }
  }

  // Check if it's a raw JWT (starts with eyJ)
  if (credential.startsWith("eyJ")) {
    return credential;
  }

  return null;
}
