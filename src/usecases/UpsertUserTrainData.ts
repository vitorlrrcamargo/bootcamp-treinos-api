import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number; // 0-100 (ex: 15 = 15%)
}

export interface OutputDto {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number; // 0-100
}

export class UpsertUserTrainData {
  public async execute(dto: InputDto): Promise<OutputDto> {
    const user = await prisma.user.update({
      where: { id: dto.userId },
      data: {
        weightInGrams: dto.weightInGrams,
        heightInCentimeters: dto.heightInCentimeters,
        age: dto.age,
        bodyFatPercentage: dto.bodyFatPercentage,
      },
    });

    return {
      userId: user.id,
      weightInGrams: user.weightInGrams!,
      heightInCentimeters: user.heightInCentimeters!,
      age: user.age!,
      bodyFatPercentage: user.bodyFatPercentage!,
    };
  }
}
