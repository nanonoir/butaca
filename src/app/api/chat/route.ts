import { APICallError, stepCountIs, streamText, type ModelMessage } from "ai";

import { ChatRequestSchema } from "@/contracts";
import {
  createChatModelChain,
  type ChatModelChain,
} from "@/features/chat/chat-model";
import { createChatTools } from "@/features/chat/chat-tools";
import { getRecommendationService } from "@/features/recommendations/recommendation-factory";
import { getTmdb } from "@/integrations/tmdb";
import { getAiEnv } from "@/lib/env/ai";
import { readJsonBody, requireViewer, runApiRoute } from "@/lib/api/route";

/** Enough turns for the model to call the tool and then talk about what came
 * back, without letting it loop. Worth reading next to the daily budgets in
 * `chat-model`: one message from a viewer spends up to this many requests. */
const MAX_STEPS = 4;

const SYSTEM_PROMPT = [
  "Sos Buti, el asistente de cine de Butaca. Respondés en español rioplatense, en tono cercano y breve.",
  "Para hablar de películas concretas SIEMPRE llamás primero a la herramienta recommendMovies.",
  "Nunca inventes títulos, años ni datos: usá solamente lo que devuelve la herramienta.",
  "Si el usuario nombra uno o varios actores, un director, una película parecida, una década, una duración o pide algo bien puntuado, pasálo en los campos correspondientes de la herramienta en vez de resolverlo vos.",
  "La herramienta puede devolver menos películas de las que esperás cuando el pedido es muy específico: mostrá las que haya y decilo, nunca completes con otras.",
  "Si la herramienta no devuelve nada, decilo con honestidad y ofrecé cambiar de criterio.",
  "No pidas ni menciones datos personales del usuario.",
].join(" ");

/** Logged in production on purpose, unlike the development-only auth reporter:
 * a spent model is the only warning that the daily budget is running out, and
 * it is rare enough not to be noise. Model ids and status codes only -- nothing
 * the viewer said. */
function reportSpentModels({ attempts }: ChatModelChain): void {
  if (attempts.length === 0) {
    return;
  }

  console.warn(
    "[chat] Fell through to another model",
    attempts.map(({ modelId, error }) => ({
      modelId,
      status: APICallError.isInstance(error) ? error.statusCode : undefined,
    })),
  );
}

function toModelMessages(
  messages: { role: "user" | "assistant"; content: string }[],
): ModelMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

export async function POST(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const { messages } = await readJsonBody(request, ChatRequestSchema);
    const viewer = await requireViewer();

    // Fails here with a clear code when the key is missing, instead of
    // surfacing a provider error mid-stream.
    getAiEnv();

    const chain = createChatModelChain();
    const result = streamText({
      model: chain.model,
      system: SYSTEM_PROMPT,
      messages: toModelMessages(messages),
      stopWhen: stepCountIs(MAX_STEPS),
      tools: createChatTools(getRecommendationService(), getTmdb(), viewer.id),
      // The chain is the retry strategy. Leaving the default in place would
      // re-run the whole chain instead, spending every model twice over.
      maxRetries: 0,
      onFinish: () => reportSpentModels(chain),
      onError: () => reportSpentModels(chain),
    });

    return result.toUIMessageStreamResponse();
  });
}
