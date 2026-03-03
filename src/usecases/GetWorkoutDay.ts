import dayjs from "dayjs";

import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  planId: string;
  dayId: string;
}

export interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  weekDay: WeekDay;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  exercises: Array<{
    id: string;
    order: number;
    name: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt: string;
    completedAt: string | null;
  }>;
}

export class GetWorkoutDay {
  public async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError(
        "You are not allowed to access this workout day",
      );
    }

    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.dayId,
        workoutPlanId: dto.planId,
      },
      include: {
        exercises: {
          orderBy: {
            order: "asc",
          },
        },
        sessions: true,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      weekDay: workoutDay.weekDay,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      exercises: workoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        order: exercise.order,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
      })),
      sessions: workoutDay.sessions.map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: dayjs(session.startedAt).toISOString(),
        completedAt: session.completedAt
          ? dayjs(session.completedAt).toISOString()
          : null,
      })),
    };
  }
}
