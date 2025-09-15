interface ProgressData {
  type: string;
  current: number;
  total: number | string;
  percentage: number;
  step: string;
  song_title: string;
  timestamp: string;
  estimated_remaining_seconds?: number;
  estimated_remaining_minutes?: number;
  clips_completed?: number;
  successful?: number;
  failed?: number;
}

interface ProcessingStats {
  startTime: Date;
  completedClips: number;
  totalClips: number;
  averageTimePerClip: number;
  processingRate: number;
  estimatedCompletion: Date;
}

export class TimeEstimationManager {
  private sessionStats = new Map<string, ProcessingStats>();
  private readonly SMOOTHING_FACTOR = 0.3; // For exponential smoothing
  private readonly MIN_SAMPLES = 3; // Minimum samples for reliable estimation

  /**
   * Initialize or update processing statistics for a user session
   */
  updateStats(userId: string, progress: ProgressData): ProcessingStats | null {
    const now = new Date();
    let stats = this.sessionStats.get(userId);

    // Initialize stats if not exists
    if (!stats) {
      if (progress.current === 0) {
        stats = {
          startTime: now,
          completedClips: 0,
          totalClips: typeof progress.total === "number" ? progress.total : 0,
          averageTimePerClip: 0,
          processingRate: 0,
          estimatedCompletion: now,
        };
        this.sessionStats.set(userId, stats);
        return stats;
      }
      return null;
    }

    // Update completed clips
    const newCompletedClips = progress.current;
    if (newCompletedClips <= stats.completedClips) {
      return stats; // No progress made
    }

    // Calculate elapsed time and new processing rate
    const elapsedMs = now.getTime() - stats.startTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    if (elapsedMinutes > 0 && newCompletedClips > 0) {
      const newProcessingRate = newCompletedClips / elapsedMinutes;
      const newAverageTimePerClip = elapsedMinutes / newCompletedClips;

      // Apply exponential smoothing for more stable estimates
      if (stats.completedClips >= this.MIN_SAMPLES) {
        stats.processingRate = this.exponentialSmooth(
          stats.processingRate,
          newProcessingRate
        );
        stats.averageTimePerClip = this.exponentialSmooth(
          stats.averageTimePerClip,
          newAverageTimePerClip
        );
      } else {
        stats.processingRate = newProcessingRate;
        stats.averageTimePerClip = newAverageTimePerClip;
      }

      stats.completedClips = newCompletedClips;

      // Update total clips if known
      if (typeof progress.total === "number") {
        stats.totalClips = progress.total;
      }

      // Calculate estimated completion time
      if (stats.totalClips > 0 && stats.processingRate > 0) {
        const remainingClips = stats.totalClips - stats.completedClips;
        const estimatedRemainingMinutes = remainingClips / stats.processingRate;
        stats.estimatedCompletion = new Date(
          now.getTime() + estimatedRemainingMinutes * 60 * 1000
        );
      }
    }

    return stats;
  }

  /**
   * Get estimated remaining time in minutes
   */
  getEstimatedRemainingTime(userId: string): number | null {
    const stats = this.sessionStats.get(userId);
    if (!stats || stats.processingRate === 0 || stats.totalClips === 0) {
      return null;
    }

    const remainingClips = stats.totalClips - stats.completedClips;
    if (remainingClips <= 0) {
      return 0;
    }

    return remainingClips / stats.processingRate;
  }

  /**
   * Get estimated completion time
   */
  getEstimatedCompletionTime(userId: string): Date | null {
    const stats = this.sessionStats.get(userId);
    return stats?.estimatedCompletion || null;
  }

  /**
   * Get processing statistics for display
   */
  getProcessingStats(userId: string): {
    averageTimePerClip: number;
    processingRate: number;
    estimatedRemainingMinutes: number | null;
    estimatedCompletionTime: Date | null;
    confidence: number;
  } | null {
    const stats = this.sessionStats.get(userId);
    if (!stats) return null;

    const estimatedRemainingMinutes = this.getEstimatedRemainingTime(userId);
    const confidence = this.calculateConfidence(stats);

    return {
      averageTimePerClip: stats.averageTimePerClip,
      processingRate: stats.processingRate,
      estimatedRemainingMinutes,
      estimatedCompletionTime: stats.estimatedCompletion,
      confidence,
    };
  }

  /**
   * Format time for display
   */
  formatTime(minutes: number): string {
    if (minutes < 1) return "1분 미만";
    if (minutes < 60) {
      return `약 ${Math.ceil(minutes)}분`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.ceil(minutes % 60);

    if (hours === 1 && remainingMinutes === 0) {
      return "약 1시간";
    }

    return `약 ${hours}시간 ${
      remainingMinutes > 0 ? remainingMinutes + "분" : ""
    }`;
  }

  /**
   * Format completion time for display
   */
  formatCompletionTime(completionTime: Date): string {
    const now = new Date();
    const diffMs = completionTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return "곧 완료";
    }

    const diffMinutes = diffMs / (1000 * 60);
    return this.formatTime(diffMinutes);
  }

  /**
   * Clean up session data
   */
  clearSession(userId: string): void {
    this.sessionStats.delete(userId);
  }

  /**
   * Clean up old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [userId, stats] of this.sessionStats.entries()) {
      if (stats.startTime < oneHourAgo) {
        this.sessionStats.delete(userId);
      }
    }
  }

  private exponentialSmooth(oldValue: number, newValue: number): number {
    return (
      oldValue * (1 - this.SMOOTHING_FACTOR) + newValue * this.SMOOTHING_FACTOR
    );
  }

  private calculateConfidence(stats: ProcessingStats): number {
    // Confidence increases with more samples and decreases with time
    const sampleConfidence = Math.min(stats.completedClips / 10, 1); // Max confidence at 10 samples
    const timeConfidence = Math.max(
      0.5,
      1 - (Date.now() - stats.startTime.getTime()) / (30 * 60 * 1000)
    ); // Decreases over 30 minutes

    return sampleConfidence * timeConfidence;
  }
}

// Global instance
export const timeEstimationManager = new TimeEstimationManager();

// Cleanup old sessions every 30 minutes
if (typeof window !== "undefined") {
  setInterval(() => {
    timeEstimationManager.cleanupOldSessions();
  }, 30 * 60 * 1000);
}
