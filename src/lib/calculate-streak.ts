import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "./db.js";

dayjs.extend(utc);

const weekDayMap: { [key: number]: WeekDay } = {
  0: WeekDay.SUNDAY,
  1: WeekDay.MONDAY,
  2: WeekDay.TUESDAY,
  3: WeekDay.WEDNESDAY,
  4: WeekDay.THURSDAY,
  5: WeekDay.FRIDAY,
  6: WeekDay.SATURDAY,
};

export const calculateWorkoutStreak = async (
  workoutPlanId: string,
  targetDate: dayjs.Dayjs,
): Promise<number> => {
  const workoutPlan = await prisma.workoutPlan.findUnique({
    where: { id: workoutPlanId },
    include: {
      workoutDays: {
        include: {
          sessions: {
            where: {
              completedAt: { not: null },
            },
            orderBy: {
              startedAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!workoutPlan) {
    return 0;
  }

  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dateToCheck = targetDate.subtract(i, "day");
    const dayOfWeek = dateToCheck.day();
    const weekDay = weekDayMap[dayOfWeek];

    const workoutDay = workoutPlan.workoutDays.find(
      (day) => day.weekDay === weekDay,
    );

    if (!workoutDay || workoutDay.isRest) {
      continue;
    }

    const dateKey = dateToCheck.format("YYYY-MM-DD");
    const hasCompletedSession = workoutDay.sessions.some(
      (session) =>
        dayjs.utc(session.startedAt).format("YYYY-MM-DD") === dateKey,
    );

    if (hasCompletedSession) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};
