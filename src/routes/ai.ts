import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat com personal trainer virtual para criar planos de treino",
      body: z.object({
        messages: z.array(z.custom<UIMessage>()),
      }),
      response: {
        200: z.any(),
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { messages } = request.body;
      const result = streamText({
        model: google("gemini-2.5-flash"),
        system: `Você é um personal trainer virtual especialista em montagem de planos de treino. Seu tom é amigável, motivador e usa linguagem simples, sem jargões técnicos. Seu público é composto por pessoas leigas em musculação.

## Protocolo de Interação

1. **SEMPRE** comece chamando a tool \`getUserTrainData\` para verificar se o usuário tem dados cadastrados.

2. **Se o usuário NÃO tem dados cadastrados** (retornou null):
   - Cumprimente-o de forma amigável
   - Pergunte de forma simples e direta em uma única mensagem: nome, peso (em kg), altura (em cm), idade e porcentagem de gordura corporal
   - Após receber os dados, salve-os com a tool \`updateUserTrainData\` (converter peso de kg para gramas multiplicando por 1000)

3. **Se o usuário JÁ tem dados cadastrados**:
   - Cumprimente-o pelo nome de forma amigável e entusiasmada

4. **Para criar um plano de treino**:
   - Pergunte o objetivo (ganho de massa, perda de gordura, condicionamento, força)
   - Quantos dias por semana está disponível para treinar
   - Se tem alguma restrição física ou lesão
   - Faça poucas perguntas, simples e diretas

## Montagem de Planos de Treino

O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY). Dias sem treino têm \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`.

### Escolha da Divisão de Treino:
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado, cada grupo 2x/semana)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

### Princípios de Montagem:
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- 4 a 8 exercícios por sessão
- 3-4 séries por exercício
- 8-12 reps (hipertrofia), 4-6 reps (força)
- Descanso entre séries: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Evitar treinar o mesmo grupo muscular em dias consecutivos
- Nomes descritivos (ex: "Peito e Tríceps", "Costas e Bíceps", "Descanso")

### Imagens de Capa (coverImageUrl):

**Dias superiores** (peito, costas, ombros, bíceps, tríceps, push, pull):
- \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v\`
- \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL\`

**Dias inferiores** (pernas, glúteos, quadríceps, posterior, panturrilha):
- \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj\`
- \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY\`

Alternar entre as duas opções de cada categoria. Dias de descanso usam imagem de superior.

## Respostas

Mantenha respostas curtas e objetivas. Seja motivador e amigável.`,
        tools: {
          getUserTrainData: tool({
            description:
              "Obtém os dados de treino do usuário (peso, altura, idade, % de gordura)",
            inputSchema: z.object({}),
            execute: async () => {
              const getUserTrainData = new GetUserTrainData();
              return await getUserTrainData.execute({
                userId: session.user.id,
              });
            },
          }),
          updateUserTrainData: tool({
            description:
              "Atualiza ou cria os dados de treino do usuário (peso, altura, idade, % de gordura)",
            inputSchema: z.object({
              weightInGrams: z
                .number()
                .int()
                .describe("Peso em gramas (ex: 75000 para 75kg)"),
              heightInCentimeters: z
                .number()
                .int()
                .describe("Altura em centímetros"),
              age: z.number().int().describe("Idade em anos"),
              bodyFatPercentage: z
                .number()
                .int()
                .min(0)
                .max(100)
                .describe(
                  "Porcentagem de gordura corporal (0-100, ex: 15 para 15%)",
                ),
            }),
            execute: async (input) => {
              const upsertUserTrainData = new UpsertUserTrainData();
              return await upsertUserTrainData.execute({
                userId: session.user.id,
                ...input,
              });
            },
          }),
          getWorkoutPlans: tool({
            description: "Lista todos os planos de treino do usuário",
            inputSchema: z.object({}),
            execute: async () => {
              const getWorkoutPlans = new GetWorkoutPlans();
              return await getWorkoutPlans.execute({
                userId: session.user.id,
              });
            },
          }),
          createWorkoutPlan: tool({
            description: "Cria um novo plano de treino completo",
            inputSchema: z.object({
              name: z.string().describe("Nome do plano de treino"),
              workoutDays: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                    weekDay: z.enum(WeekDay).describe("Dia da semana"),
                    isRest: z
                      .boolean()
                      .describe(
                        "Se é dia de descanso (true) ou treino (false)",
                      ),
                    estimatedDurationInSeconds: z
                      .number()
                      .describe(
                        "Duração estimada em segundos (0 para dias de descanso)",
                      ),
                    coverImageUrl: z
                      .url()
                      .describe(
                        "URL da imagem de capa do dia de treino. Usar as URLs de superior ou inferior conforme o foco muscular do dia.",
                      ),
                    exercises: z
                      .array(
                        z.object({
                          order: z
                            .number()
                            .describe("Ordem do exercício no dia"),
                          name: z.string().describe("Nome do exercício"),
                          sets: z.number().describe("Número de séries"),
                          reps: z.number().describe("Número de repetições"),
                          restTimeInSeconds: z
                            .number()
                            .describe(
                              "Tempo de descanso entre séries em segundos",
                            ),
                        }),
                      )
                      .describe(
                        "Lista de exercícios (vazia para dias de descanso)",
                      ),
                  }),
                )
                .describe(
                  "Array com exatamente 7 dias de treino (MONDAY a SUNDAY)",
                ),
            }),
            execute: async (input) => {
              const createWorkoutPlan = new CreateWorkoutPlan();

              return await createWorkoutPlan.execute({
                userId: session.user.id,
                name: input.name,
                workoutDays: input.workoutDays,
              });
            },
          }),
        },
        stopWhen: stepCountIs(5),
        messages: await convertToModelMessages(messages),
      });

      const response = result.toUIMessageStreamResponse();
      reply.status(200);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      if (!response.body) {
        return reply.send();
      }

      return reply.send(response.body);
    },
  });
};
