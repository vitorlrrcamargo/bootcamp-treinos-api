import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { auth } from "../lib/auth.js";
import {
  ErrorSchema,
  GetUserTrainDataOrNullResponseSchema,
  UpsertUserTrainDataBodySchema,
  UpsertUserTrainDataResponseSchema,
} from "../schemas/index.js";
import {
  GetUserTrainData,
  OutputDto as GetUserTrainDataOutputDto,
} from "../usecases/GetUserTrainData.js";
import {
  OutputDto as UpsertUserTrainDataOutputDto,
  UpsertUserTrainData,
} from "../usecases/UpsertUserTrainData.js";

export const meRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "getUserTrainData",
      tags: ["User"],
      summary: "Get user train data",
      response: {
        200: GetUserTrainDataOrNullResponseSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const getUserTrainData = new GetUserTrainData();
        const result: GetUserTrainDataOutputDto | null =
          await getUserTrainData.execute({
            userId: session.user.id,
          });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/",
    schema: {
      operationId: "upsertUserTrainData",
      tags: ["User"],
      summary: "Create or update user train data",
      body: UpsertUserTrainDataBodySchema,
      response: {
        200: UpsertUserTrainDataResponseSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const upsertUserTrainData = new UpsertUserTrainData();
        const result: UpsertUserTrainDataOutputDto =
          await upsertUserTrainData.execute({
            userId: session.user.id,
            weightInGrams: request.body.weightInGrams,
            heightInCentimeters: request.body.heightInCentimeters,
            age: request.body.age,
            bodyFatPercentage: request.body.bodyFatPercentage,
          });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
