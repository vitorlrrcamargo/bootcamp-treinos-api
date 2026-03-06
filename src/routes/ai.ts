import { groq } from "@ai-sdk/groq";
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
        model: groq("llama-3.1-8b-instant"),
        system: `Você é um personal trainer virtual especialista em montagem de planos de treino personalizados.

## Personalidade
- Tom amigável, motivador e acolhedor.
- Linguagem simples e direta, sem jargões técnicos. Seu público principal são pessoas leigas em musculação.
- Respostas curtas e objetivas.

## Regras de Interação

1. **SEMPRE** chame a tool \`getUserTrainData\` antes de qualquer interação com o usuário. Isso é obrigatório.
2. Se o usuário **não tem dados cadastrados** (retornou null):
   - Pergunte nome, peso (kg), altura (cm), idade e % de gordura corporal (inteiro de 0 a 100, onde 100 = 100%).
   - Faça perguntas simples e diretas, tudo em uma única mensagem.
   - Após receber os dados, salve com a tool \`updateUserTrainData\`. **IMPORTANTE**: converta o peso de kg para gramas (multiplique por 1000) antes de salvar.
3. Se o usuário **já tem dados cadastrados**: cumprimente-o pelo nome de forma amigável.

## Criação de Plano de Treino

Quando o usuário quiser criar um plano de treino:
- Pergunte o objetivo, quantos dias por semana ele pode treinar e se tem restrições físicas ou lesões.
- Poucas perguntas, simples e diretas.
- O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY).
- Dias sem treino devem ter: \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`.
- Chame a tool \`createWorkoutPlan\` para salvar o plano.

### Divisões de Treino (Splits)

Escolha a divisão adequada com base nos dias disponíveis:
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado, cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x/semana)
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

### Princípios Gerais de Montagem
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- 4 a 8 exercícios por sessão
- 3-4 séries por exercício. 8-12 reps (hipertrofia), 4-6 reps (força)
- Descanso entre séries: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Evitar treinar o mesmo grupo muscular em dias consecutivos
- Nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso")

### Imagens de Capa (coverImageUrl)

SEMPRE forneça um \`coverImageUrl\` para cada dia de treino. Escolha com base no foco muscular:

**Dias majoritariamente superiores** (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

**Dias majoritariamente inferiores** (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

Alterne entre as duas opções de cada categoria para variar. Dias de descanso usam imagem de superior.`,
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
