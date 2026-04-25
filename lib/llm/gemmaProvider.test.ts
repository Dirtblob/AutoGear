import { describe, expect, it, vi } from "vitest";
import { createGemmaProvider } from "./gemmaProvider";

describe("gemma provider", () => {
  it("calls the Gemini generateContent endpoint for hosted Gemma", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"headline":"h","explanation":"e","tradeoffs":"t","whyThisHelps":"w","whyNotCheaper":"c","whyNotMoreExpensive":"m","confidenceNote":"n","followUpQuestion":"q"}',
                  },
                ],
              },
            },
          ],
        }),
      }) as unknown as Response,
    );
    const logger = { error: vi.fn() };
    const provider = createGemmaProvider({
      apiBaseUrl: "http://localhost:8000/v1",
      apiKey: "secret",
      model: "gemma-4",
      fetchImpl: fetchMock as unknown as typeof fetch,
      logger,
    });

    await provider.completeJson({
      system: "system",
      prompt: '{"facts":{}}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8000/v1/models/gemma-4:generateContent");
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      "content-type": "application/json",
      "x-goog-api-key": "secret",
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      system_instruction: {
        parts: [{ text: "system" }],
      },
      contents: [{ role: "user", parts: [{ text: '{"facts":{}}' }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
  });

  it("does not retry rate-limited Gemini responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: "Quota exceeded",
        },
      }),
    } as unknown as Response);
    const logger = { error: vi.fn() };
    const provider = createGemmaProvider({
      apiBaseUrl: "http://localhost:8000/v1",
      apiKey: "secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
      logger,
    });

    await expect(
      provider.completeJson({
        system: "system",
        prompt: '{"facts":{}}',
      }),
    ).rejects.toThrow("429");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
