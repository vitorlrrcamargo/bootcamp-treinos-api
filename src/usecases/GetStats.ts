import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { calculateWorkoutStreak } from "../lib/calculate-streak.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

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

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
    });

    const workoutStreak = activeWorkoutPlan
      ? await calculateWorkoutStreak(activeWorkoutPlan.id, dayjs.utc(dto.to))
      : 0;

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }
}
