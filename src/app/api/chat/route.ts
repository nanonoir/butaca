import { google } from "@ai-sdk/google";
import { stepCountIs, streamText, type ModelMessage } from "ai";

import { ChatRequestSchema } from "@/contracts";
import { createChatTools } from "@/features/chat/chat-tools";
import { getRecommendationService } from "@/features/recommendations/recommendation-factory";
import { getAiEnv } from "@/lib/env/ai";
import { readJsonBody, requireViewer, runApiRoute } from "@/lib/api/route";

/** Pinned rather than an alias like `gemini-flash-latest`: a floating alias
 * swaps the model underneath, and tool calling is the fragile part here. */
const CHAT_MODEL = "gemini-3.6-flash";

/** Enough turns for the model to call the tool and then talk about what came
 * back, without letting it loop. */
const MAX_STEPS = 4;

const SYSTEM_PROMPT = [
  "Sos Buti, el asistente de cine de Butaca. Respondés en español rioplatense, en tono cercano y breve.",
  "Para hablar de películas concretas SIEMPRE llamás primero a la herramienta recommendMovies.",
  "Nunca inventes títulos, años ni datos: usá solamente lo que devuelve la herramienta.",
  "Si la herramienta no devuelve nada, decilo con honestidad y ofrecé cambiar de criterio.",
  "No pidas ni menciones datos personales del usuario.",
].join(" ");

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

    const result = streamText({
      model: google(CHAT_MODEL),
      system: SYSTEM_PROMPT,
      messages: toModelMessages(messages),
      stopWhen: stepCountIs(MAX_STEPS),
      tools: createChatTools(getRecommendationService(), viewer.id),
    });

    return result.toUIMessageStreamResponse();
  });
}
