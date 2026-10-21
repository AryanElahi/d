import { afterEach, describe, expect, it, vi } from "vitest";
import type { Vocab } from "./parser";

const vocab: Vocab = { areas: ["فردوسی"], brands: [], categories: [] };

async function load() {
  vi.resetModules();
  vi.stubEnv("LLM_BASE_URL", "https://llm.test/v1/");
  vi.stubEnv("LLM_API_KEY", "test-key");
  vi.stubEnv("LLM_MODEL", "test-model");
  return import("./llm");
}

const reply = (content: string) =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("askLlm", () => {
  it("disabled without env", async () => {
    vi.resetModules();
    const { askLlm, llmEnabled } = await import("./llm");
    const f = vi.fn();
    expect(llmEnabled()).toBe(false);
    expect(await askLlm("x", vocab, f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("posts to chat/completions, parses, caches", async () => {
    const { askLlm } = await load();
    const f = reply('{"keywords":"دوربین مدار بسته"}');
    expect(await askLlm("یه چیزی برای مغازه", vocab, f as never)).toEqual({ keywords: "دوربین مدار بسته" });
    expect(await askLlm("یه چیزی برای مغازه", vocab, f as never)).toEqual({ keywords: "دوربین مدار بسته" });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
  });

  it("times out to null", async () => {
    vi.useFakeTimers();
    const { askLlm } = await load();
    const hang = vi.fn(
      (_: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const p = askLlm("کند", vocab, hang as never);
    await vi.advanceTimersByTimeAsync(3100);
    expect(await p).toBeNull();
  });

  it("http error → null", async () => {
    const { askLlm } = await load();
    expect(await askLlm("خطا", vocab, vi.fn(async () => new Response("no", { status: 500 })) as never)).toBeNull();
  });
});
