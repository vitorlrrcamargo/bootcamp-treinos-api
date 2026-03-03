import dayjs from "dayjs";

import {
  ForbiddenError,
  NotFoundError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  planId: string;
  dayId: string;
}

export interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  public async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError(
        "You are not allowed to start this workout session",
      );
    }

    if (!workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active");
    }

    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.dayId,
        workoutPlanId: dto.planId,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return prisma.$transaction(async (tx) => {
      const existingOpenSession = await tx.workoutSession.findFirst({
        where: {
          workoutDayId: dto.dayId,
          completedAt: null,
        },
      });

      if (existingOpenSession) {
        throw new WorkoutSessionAlreadyStartedError(
          "Workout day already has an active session",
        );
      }

      const workoutSession = await tx.workoutSession.create({
        data: {
          workoutDayId: dto.dayId,
          startedAt: dayjs().toDate(),
        },
      });

      return {
        userWorkoutSessionId: workoutSession.id,
      };
    });
  }
}
