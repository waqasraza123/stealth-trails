import { loadAiWealthBriefRuntimeConfig } from "@stealth-trails-bank/config/api";

function buildEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    AI_WEALTH_BRIEF_PROVIDER: "openai_compatible",
    AI_WEALTH_BRIEF_ENDPOINT: "https://provider.example.com/v1/chat/completions",
    AI_WEALTH_BRIEF_ALLOWED_HOSTS: "provider.example.com",
    AI_WEALTH_BRIEF_API_KEY: "test-api-key",
    AI_WEALTH_BRIEF_MODEL: "test-model",
    ...overrides,
  };
}

describe("loadAiWealthBriefRuntimeConfig", () => {
  it("returns a normalized config for an allow-listed HTTPS endpoint", () => {
    const config = loadAiWealthBriefRuntimeConfig(buildEnv());

    expect(config.provider).toBe("openai_compatible");
    expect(config.endpoint).toBe(
      "https://provider.example.com/v1/chat/completions",
    );
    expect(config.allowedProviderHosts).toEqual(["provider.example.com"]);
    expect(config.localProviderExceptionEnabled).toBe(false);
  });

  it("keeps the provider disabled by default without requiring provider settings", () => {
    const config = loadAiWealthBriefRuntimeConfig({});

    expect(config.provider).toBe("disabled");
    expect(config.endpoint).toBeNull();
    expect(config.apiKey).toBeNull();
    expect(config.allowedProviderHosts).toEqual([]);
  });

  it("fails closed when the allow-list is missing", () => {
    const env = buildEnv();
    delete env["AI_WEALTH_BRIEF_ALLOWED_HOSTS"];

    expect(() => loadAiWealthBriefRuntimeConfig(env)).toThrow(
      /AI_WEALTH_BRIEF_ALLOWED_HOSTS/u,
    );
  });

  it("rejects an endpoint host that is not in the allow-list", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          AI_WEALTH_BRIEF_ENDPOINT: "https://evil.example.net/v1/chat/completions",
        }),
      ),
    ).toThrow(/not present in AI_WEALTH_BRIEF_ALLOWED_HOSTS/u);
  });

  it("rejects non-HTTPS endpoints without the development exception", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          AI_WEALTH_BRIEF_ENDPOINT: "http://provider.example.com/v1/chat/completions",
        }),
      ),
    ).toThrow(/must use HTTPS/u);
  });

  it("rejects malformed endpoint URLs", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({ AI_WEALTH_BRIEF_ENDPOINT: "not a url" }),
      ),
    ).toThrow(/must be a valid absolute URL/u);
  });

  it("rejects endpoints with embedded credentials", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          AI_WEALTH_BRIEF_ENDPOINT:
            "https://user:secret@provider.example.com/v1/chat/completions",
        }),
      ),
    ).toThrow(/must not embed credentials/u);
  });

  it("rejects endpoints with query strings or fragments", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          AI_WEALTH_BRIEF_ENDPOINT:
            "https://provider.example.com/v1/chat/completions?key=abc",
        }),
      ),
    ).toThrow(/must not contain a query string or fragment/u);
  });

  it.each([
    "https://127.0.0.1/v1/chat/completions",
    "https://10.0.0.4/v1/chat/completions",
    "https://192.168.1.10/v1/chat/completions",
    "https://169.254.169.254/latest/meta-data",
    "https://2130706433/v1/chat/completions",
    "https://0x7f000001/v1/chat/completions",
    "https://[::1]/v1/chat/completions",
    "https://[::ffff:127.0.0.1]/v1/chat/completions",
    "https://[fd00::1]/v1/chat/completions",
  ])("rejects IP literal endpoint %s", (endpoint) => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({ AI_WEALTH_BRIEF_ENDPOINT: endpoint }),
      ),
    ).toThrow(/must not use an IP literal host/u);
  });

  it.each([
    "https://localhost/v1/chat/completions",
    "https://api.localhost/v1/chat/completions",
    "https://metadata.internal/v1/chat/completions",
    "https://db.local/v1/chat/completions",
    "https://singlelabel/v1/chat/completions",
  ])("rejects internal endpoint %s", (endpoint) => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({ AI_WEALTH_BRIEF_ENDPOINT: endpoint }),
      ),
    ).toThrow(/loopback, single-label, or internal hostname/u);
  });

  it("rejects wildcard allow-list entries", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({ AI_WEALTH_BRIEF_ALLOWED_HOSTS: "*.example.com" }),
      ),
    ).toThrow(/must be a bare hostname/u);
  });

  it("allows a loopback HTTP mock only with the explicit development exception", () => {
    const config = loadAiWealthBriefRuntimeConfig(
      buildEnv({
        NODE_ENV: "development",
        AI_WEALTH_BRIEF_ALLOW_LOCAL_PROVIDER: "true",
        AI_WEALTH_BRIEF_ALLOWED_HOSTS: "localhost,127.0.0.1",
        AI_WEALTH_BRIEF_ENDPOINT: "http://localhost:4010/v1/chat/completions",
      }),
    );

    expect(config.endpoint).toBe("http://localhost:4010/v1/chat/completions");
    expect(config.localProviderExceptionEnabled).toBe(true);
  });

  it("rejects the local provider exception in production", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          NODE_ENV: "production",
          AI_WEALTH_BRIEF_ALLOW_LOCAL_PROVIDER: "true",
          AI_WEALTH_BRIEF_ALLOWED_HOSTS: "localhost",
          AI_WEALTH_BRIEF_ENDPOINT: "http://localhost:4010/v1/chat/completions",
        }),
      ),
    ).toThrow(/must not be enabled when NODE_ENV=production/u);
  });

  it("rejects plain HTTP to non-loopback hosts even with the development exception", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          NODE_ENV: "development",
          AI_WEALTH_BRIEF_ALLOW_LOCAL_PROVIDER: "true",
          AI_WEALTH_BRIEF_ENDPOINT: "http://provider.example.com/v1/chat/completions",
        }),
      ),
    ).toThrow(/must use HTTPS/u);
  });

  it("still enforces the allow-list when the development exception is enabled", () => {
    expect(() =>
      loadAiWealthBriefRuntimeConfig(
        buildEnv({
          NODE_ENV: "development",
          AI_WEALTH_BRIEF_ALLOW_LOCAL_PROVIDER: "true",
          AI_WEALTH_BRIEF_ENDPOINT: "http://localhost:4010/v1/chat/completions",
        }),
      ),
    ).toThrow(/not present in AI_WEALTH_BRIEF_ALLOWED_HOSTS/u);
  });
});
