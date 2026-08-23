import { z } from "zod";

import { TmdbMovieIdSchema } from "./common";

import { MovieSummarySchema } from "./movies";

export const ChatRoleSchema = z.enum(["user", "assistant"]);

export const ChatMessageSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  role: ChatRoleSchema,
  content: z.string().trim().min(1).max(4000),
});

export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1).max(20),
    /** The movie the viewer has in front of them, when the conversation starts
     * from a card rather than from an empty assistant screen. Only the id
     * travels: the server resolves the title itself rather than trusting a
     * caller with what goes into the model's instructions. */
    aboutMovieId: TmdbMovieIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const lastMessage = value.messages[value.messages.length - 1];

    if (lastMessage?.role !== "user") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "The last chat message must be from the user",
      });
    }
  });

export const ChatMovieRecommendationsPayloadSchema = z.object({
  movies: z.array(MovieSummarySchema).min(1).max(10),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatMovieRecommendationsPayload = z.infer<
  typeof ChatMovieRecommendationsPayloadSchema
>;
