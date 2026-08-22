import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { doStream, google } = vi.hoisted(() => {
  const doStream = vi.fn();

  return {
    doStream,
    google: vi.fn((modelId: string) => ({
      specificationVersion: "v3",
      provider: "google",
      modelId,
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: (options: unknown) => doStream(modelId, options),
    })),
  };
});

vi.mock("@ai-sdk/google", () => ({ google }));

import { CHAT_MODEL_IDS, createChatModelChain } from "./chat-model";

function apiError(statusCode: number | undefined) {
  return new APICallError({
    message: `status ${statusCode}`,
    statusCode,
    url: "https://generativelanguage.googleapis.com",
    requestBodyValues: {},
  });
}

/** The shape `doStream` resolves with. Only its identity matters here: the
 * chain must hand back exactly what the model produced. */
function streamResult(modelId: string) {
  return { stream: `stream-from-${modelId}` };
}

/** wrapLanguageModel hands back a model whose own doStream runs the middleware,
 * so driving the chain means calling it exactly as the AI SDK would. */
async function runChain(modelIds?: readonly string[]) {
  const chain = createChatModelChain(modelIds);
  const result = await (
    chain.model as unknown as {
      doStream: (options: unknown) => Promise<{ stream: string }>;
    }
  ).doStream({ prompt: [] });

  return { chain, result };
}

beforeEach(() => {
  doStream.mockReset();
  google.mockClear();
});

describe("createChatModelChain", () => {
  it("leads with the model that carries the most daily budget", () => {
    expect(CHAT_MODEL_IDS[0]).toBe("gemini-3.5-flash-lite");
    expect(CHAT_MODEL_IDS[1]).toBe("gemini-3.1-flash-lite");
  });

  it("pins every model instead of tracking a floating alias", () => {
    for (const modelId of CHAT_MODEL_IDS) {
      expect(modelId).not.toContain("latest");
    }
  });

  it("asks nothing beyond the first model when it answers", async () => {
    doStream.mockImplementation(async (modelId: string) =>
      streamResult(modelId),
    );

    const { chain, result } = await runChain();

    expect(result).toEqual(streamResult("gemini-3.5-flash-lite"));
    expect(doStream).toHaveBeenCalledTimes(1);
    expect(chain.attempts).toEqual([]);
  });

  it("hands an exhausted quota to the next model", async () => {
    doStream
      .mockRejectedValueOnce(apiError(429))
      .mockImplementation(async (modelId: string) => streamResult(modelId));

    const { chain, result } = await runChain();

    expect(result).toEqual(streamResult("gemini-3.1-flash-lite"));
    expect(chain.attempts.map(({ modelId }) => modelId)).toEqual([
      "gemini-3.5-flash-lite",
    ]);
  });

  it("walks past a model buckling under load", async () => {
    doStream
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503))
      .mockImplementation(async (modelId: string) => streamResult(modelId));

    const { chain, result } = await runChain();

    expect(result).toEqual(streamResult("gemini-3.6-flash"));
    expect(chain.attempts).toHaveLength(2);
  });

  it("treats a transport fault as this model's problem", async () => {
    doStream
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockImplementation(async (modelId: string) => streamResult(modelId));

    const { result } = await runChain();

    expect(result).toEqual(streamResult("gemini-3.1-flash-lite"));
  });

  /** A malformed request or a bad key fails the same way everywhere, so
   * walking the chain would turn one wasted call into six. */
  it("stops at a rejected request instead of spending every model on it", async () => {
    doStream.mockRejectedValue(apiError(400));

    await expect(runChain()).rejects.toThrow("status 400");
    expect(doStream).toHaveBeenCalledTimes(1);
  });

  /** Google retires model ids; this project has already lost one that way. */
  it("walks past a model that no longer exists", async () => {
    doStream
      .mockRejectedValueOnce(apiError(404))
      .mockImplementation(async (modelId: string) => streamResult(modelId));

    const { result } = await runChain();

    expect(result).toEqual(streamResult("gemini-3.1-flash-lite"));
  });

  it("stops when the key itself is refused", async () => {
    doStream.mockRejectedValue(apiError(401));

    await expect(runChain()).rejects.toThrow("status 401");
    expect(doStream).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last failure once every model is spent", async () => {
    doStream.mockRejectedValue(apiError(429));

    await expect(runChain()).rejects.toThrow("status 429");
    expect(doStream).toHaveBeenCalledTimes(CHAT_MODEL_IDS.length);
  });

  it("passes the same request on to each model it tries", async () => {
    doStream
      .mockRejectedValueOnce(apiError(429))
      .mockImplementation(async (modelId: string) => streamResult(modelId));

    await runChain();

    const [, firstOptions] = doStream.mock.calls[0]!;
    const [, secondOptions] = doStream.mock.calls[1]!;

    expect(secondOptions).toEqual(firstOptions);
  });

  it("refuses to build an empty chain", () => {
    expect(() => createChatModelChain([])).toThrow(
      "A chat model chain needs at least one model",
    );
  });
});
