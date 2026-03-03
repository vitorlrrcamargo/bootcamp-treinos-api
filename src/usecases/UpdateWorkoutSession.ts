import dayjs from "dayjs";

import {
  ForbiddenError,
  NotFoundError,
  WorkoutSessionAlreadyCompletedError,
} from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  planId: string;
  dayId: string;
  sessionId: string;
  completedAt: Date;
}

export interface OutputDto {
  userWorkoutSessionId: string;
  completedAt: string;
  startedAt: string;
}

export class UpdateWorkoutSession {
  public async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError(
        "You are not allowed to update this workout session",
      );
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
      const workoutSession = await tx.workoutSession.findFirst({
        where: {
          id: dto.sessionId,
          workoutDayId: dto.dayId,
        },
      });

      if (!workoutSession) {
        throw new NotFoundError("Workout session not found");
      }

      if (workoutSession.completedAt !== null) {
        throw new WorkoutSessionAlreadyCompletedError(
          "Workout session is already completed",
        );
      }

      const updatedSession = await tx.workoutSession.update({
        where: { id: dto.sessionId },
        data: {
          completedAt: dto.completedAt,
        },
      });

      return {
        userWorkoutSessionId: updatedSession.id,
        completedAt: dayjs(updatedSession.completedAt).toISOString(),
        startedAt: dayjs(updatedSession.startedAt).toISOString(),
      };
    });
  }
}
