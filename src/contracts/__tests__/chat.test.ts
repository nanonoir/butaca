import { describe, expect, it } from "vitest";

import { ChatMessageSchema, ChatRequestSchema } from "../chat";

describe("ChatMessageSchema", () => {
  it("accepts a message without an ID", () => {
    const result = ChatMessageSchema.safeParse({
      role: "user",
      content: "Recommend a movie",
    });

    expect(result.success).toBe(true);
  });
});

describe("ChatRequestSchema", () => {
  it("accepts a request ending with a user message", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [
        { role: "assistant", content: "What kind of movie do you want?" },
        { role: "user", content: "A science-fiction movie" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a request ending with an assistant message", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "assistant", content: "Here is a recommendation" }],
    });

    expect(result.success).toBe(false);
  });
});
