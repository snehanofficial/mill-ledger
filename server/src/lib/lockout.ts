export interface LockoutEntry {
  attempts: number;
  lastAttemptTime: number;
  lockedUntil?: number;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class LockoutService {
  private entries = new Map<string, LockoutEntry>();

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Check if an account is currently locked out
   */
  isLocked(email: string): boolean {
    const key = this.normalizeEmail(email);
    const entry = this.entries.get(key);
    if (!entry) return false;

    if (entry.lockedUntil) {
      if (Date.now() >= entry.lockedUntil) {
        // Lockout expired, reset attempts
        this.entries.delete(key);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Get remaining lockout duration in seconds
   */
  getRemainingLockoutSeconds(email: string): number {
    const key = this.normalizeEmail(email);
    const entry = this.entries.get(key);
    if (!entry?.lockedUntil) return 0;

    const remainingMs = entry.lockedUntil - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  /**
   * Get current failed attempt count
   */
  getFailedAttempts(email: string): number {
    const key = this.normalizeEmail(email);
    return this.entries.get(key)?.attempts ?? 0;
  }

  /**
   * Record a failed login attempt. Locks the account if threshold reached.
   */
  recordFailure(email: string): { locked: boolean; attempts: number } {
    const key = this.normalizeEmail(email);
    const now = Date.now();
    const current = this.entries.get(key);

    const attempts = (current?.attempts ?? 0) + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;

    this.entries.set(key, {
      attempts,
      lastAttemptTime: now,
      lockedUntil: locked ? now + LOCKOUT_DURATION_MS : undefined,
    });

    return { locked, attempts };
  }

  /**
   * Record a successful login attempt, resetting the failure counter
   */
  recordSuccess(email: string): void {
    const key = this.normalizeEmail(email);
    this.entries.delete(key);
  }

  /**
   * Reset lockout entry for a specific email or all accounts (test utility)
   */
  reset(email?: string): void {
    if (email) {
      this.entries.delete(this.normalizeEmail(email));
    } else {
      this.entries.clear();
    }
  }
}

export const lockoutService = new LockoutService();
