import {
  assertEvaluationEnvironment,
  evaluationSubject,
  isPrivateEvaluationPeer,
} from "./evaluation.config";

describe("Evaluation isolation configuration", () => {
  const config = {
    NODE_ENV: "test",
    AI_EVALUATION_ENABLED: "true",
    DATABASE_URL:
      "postgresql://fixture:fixture@127.0.0.1:55439/stealth_trails_agent_eval",
  };
  it("requires explicit opt-in and a dedicated local database", () => {
    expect(() => assertEvaluationEnvironment(config)).not.toThrow();
    for (const bad of [
      { AI_EVALUATION_ENABLED: "false" },
      { NODE_ENV: "production" },
      { VERCEL_ENV: "production" },
      { VERCEL: "1" },
      {
        DATABASE_URL:
          "postgresql://x:x@production.example/stealth_trails_agent_eval",
      },
      { DATABASE_URL: "postgresql://x:x@localhost/production" },
      { WALLET_PRIVATE_KEY: "fixture-forbidden" },
      { DOCUMENT_AI_ENABLED: "true" },
    ]) {
      expect(() =>
        assertEvaluationEnvironment({ ...config, ...bad }),
      ).toThrow();
    }
  });
  it("binds separate authentication keys to fixture identities", () => {
    const env = {
      AI_EVALUATION_API_KEY: "a".repeat(32),
      AI_EVALUATION_PEER_API_KEY: "b".repeat(32),
    };
    expect(evaluationSubject(`Bearer ${env.AI_EVALUATION_API_KEY}`, env)).toBe(
      "eval-aurora",
    );
    expect(
      evaluationSubject(`Bearer ${env.AI_EVALUATION_PEER_API_KEY}`, env),
    ).toBe("eval-boreal");
    expect(evaluationSubject("Bearer nope", env)).toBeNull();
  });
  it("ignores proxy headers and restricts actual socket peers", () => {
    expect(isPrivateEvaluationPeer("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateEvaluationPeer("172.19.0.5")).toBe(true);
    expect(isPrivateEvaluationPeer("8.8.8.8")).toBe(false);
    expect(isPrivateEvaluationPeer(undefined)).toBe(false);
  });
});
