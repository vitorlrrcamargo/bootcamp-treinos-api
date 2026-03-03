import dayjs from "dayjs";

import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface OutputDto {
  workoutStreak: number;
  consistencyByDay: {
    [key: string]: {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    };
  };
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  public async execute(dto: InputDto): Promise<OutputDto> {
    // Parse dates with dayjs
    const fromDate = dayjs.utc(dto.from).startOf("day");
    const toDate = dayjs.utc(dto.to).endOf("day");

    // Fetch all workout sessions in the date range
    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
      include: {
        workoutDay: {
          select: {
            isRest: true,
          },
        },
      },
    });

    // Group sessions by date
    const sessionsByDate: {
      [key: string]: Array<{
        startedAt: Date;
        completedAt: Date | null;
        isRest: boolean;
      }>;
    } = {};

    sessions.forEach((session) => {
      const dateKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = [];
      }
      sessionsByDate[dateKey].push({
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        isRest: session.workoutDay.isRest,
      });
    });

    // Build consistency by day
    const consistencyByDay: {
      [key: string]: {
        workoutDayCompleted: boolean;
        workoutDayStarted: boolean;
      };
    } = {};

    let completedWorkoutsCount = 0;

    Object.entries(sessionsByDate).forEach(([dateKey, daySessions]) => {
      const hasStarted = daySessions.some((s) => s.startedAt !== null);
      const hasCompleted = daySessions.some((s) => s.completedAt !== null);

      consistencyByDay[dateKey] = {
        workoutDayStarted: hasStarted,
        workoutDayCompleted: hasCompleted,
      };

      if (hasCompleted) {
        completedWorkoutsCount++;
      }
    });

    // Calculate conclusion rate
    const totalSessions = Object.keys(sessionsByDate).length;
    const conclusionRate =
      totalSessions > 0 ? completedWorkoutsCount / totalSessions : 0;

    // Calculate total time in seconds
    let totalTimeInSeconds = 0;
    sessions.forEach((session) => {
      if (session.completedAt && session.startedAt) {
        const durationMs =
          session.completedAt.getTime() - session.startedAt.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        totalTimeInSeconds += durationSeconds;
      }
    });

    // Calculate workout streak
    const workoutStreak = this.calculateStreak(consistencyByDay);

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private calculateStreak(consistencyByDay: {
    [key: string]: {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    };
  }): number {
    // Get all dates sorted in descending order
    const dates = Object.keys(consistencyByDay).sort().reverse();

    if (dates.length === 0) {
      return 0;
    }

    let streak = 0;
    let currentDate = dayjs.utc(dates[0]);

    for (const dateKey of dates) {
      const expectedDate = currentDate.format("YYYY-MM-DD");

      // If this date is not the expected date, streak is broken
      if (dateKey !== expectedDate) {
        break;
      }

      // If workout was completed on this date, increment streak
      if (consistencyByDay[dateKey].workoutDayCompleted) {
        streak++;
        currentDate = currentDate.subtract(1, "day");
      } else {
        // If workout was not completed, streak breaks
        break;
      }
    }

    return streak;
  }
}
