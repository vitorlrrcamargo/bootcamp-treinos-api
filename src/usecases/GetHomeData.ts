import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import weekday from "dayjs/plugin/weekday.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { calculateWorkoutStreak } from "../lib/calculate-streak.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);
dayjs.extend(weekday);

interface InputDto {
  userId: string;
  date: string; // YYYY-MM-DD
}

export interface OutputDto {
  activeWorkoutPlanId?: string;
  todayWorkoutDay?: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: {
    [key: string]: {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    };
  };
}

export class GetHomeData {
  public async execute(dto: InputDto): Promise<OutputDto> {
    // Parse date and calculate week range (Sunday to Saturday) in UTC
    const targetDate = dayjs.utc(dto.date);
    const weekStart = targetDate.weekday(0).startOf("day"); // Sunday
    const weekEnd = targetDate.weekday(6).endOf("day"); // Saturday

    // Find active workout plan
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            exercises: true,
            sessions: {
              where: {
                startedAt: {
                  gte: weekStart.toDate(),
                  lte: weekEnd.toDate(),
                },
              },
            },
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      return {
        activeWorkoutPlanId: undefined,
        todayWorkoutDay: undefined,
        workoutStreak: 0,
        consistencyByDay: {},
      };
    }

    // Map date to WeekDay enum
    const dayOfWeek = targetDate.day(); // 0 = Sunday, 6 = Saturday
    const weekDayMap: { [key: number]: WeekDay } = {
      0: WeekDay.SUNDAY,
      1: WeekDay.MONDAY,
      2: WeekDay.TUESDAY,
      3: WeekDay.WEDNESDAY,
      4: WeekDay.THURSDAY,
      5: WeekDay.FRIDAY,
      6: WeekDay.SATURDAY,
    };
    const targetWeekDay = weekDayMap[dayOfWeek];

    // Find today's workout day
    const todayWorkoutDay = activeWorkoutPlan.workoutDays.find(
      (day) => day.weekDay === targetWeekDay,
    );

    // if (!todayWorkoutDay) {
    //   throw new NotFoundError("No workout day found for this date");
    // }

    // Build consistency by day for the entire week
    const consistencyByDay: {
      [key: string]: {
        workoutDayCompleted: boolean;
        workoutDayStarted: boolean;
      };
    } = {};

    for (let i = 0; i < 7; i++) {
      const currentDay = weekStart.add(i, "day");
      const dateKey = currentDay.format("YYYY-MM-DD");

      // Initialize with no activity
      consistencyByDay[dateKey] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };

      // Check if there are any sessions for this day
      const currentDayOfWeek = currentDay.day();
      const currentWeekDay = weekDayMap[currentDayOfWeek];

      const workoutDayForDate = activeWorkoutPlan.workoutDays.find(
        (day) => day.weekDay === currentWeekDay,
      );

      if (workoutDayForDate) {
        // Check if any session exists for this specific date
        const sessionsForDate = workoutDayForDate.sessions.filter((session) => {
          const sessionDate = dayjs.utc(session.startedAt);
          return sessionDate.format("YYYY-MM-DD") === dateKey;
        });

        if (sessionsForDate.length > 0) {
          const hasStarted = sessionsForDate.some((s) => s.startedAt !== null);
          const hasCompleted = sessionsForDate.some(
            (s) => s.completedAt !== null,
          );

          consistencyByDay[dateKey] = {
            workoutDayStarted: hasStarted,
            workoutDayCompleted: hasCompleted,
          };
        }
      }
    }

    const workoutStreak = await calculateWorkoutStreak(
      activeWorkoutPlan.id,
      targetDate,
    );

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: todayWorkoutDay
        ? {
            workoutPlanId: activeWorkoutPlan.id,
            id: todayWorkoutDay.id,
            name: todayWorkoutDay.name,
            isRest: todayWorkoutDay.isRest,
            weekDay: todayWorkoutDay.weekDay,
            estimatedDurationInSeconds:
              todayWorkoutDay.estimatedDurationInSeconds,
            coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
            exercisesCount: todayWorkoutDay.exercises.length,
          }
        : undefined,
      workoutStreak,
      consistencyByDay,
    };
  }
}
