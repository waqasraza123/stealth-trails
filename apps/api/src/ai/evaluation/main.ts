import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { assertEvaluationEnvironment } from "./evaluation.config";

export async function startEvaluationServer() {
  const config = assertEvaluationEnvironment();
  if (
    !process.env.AI_EVALUATION_API_KEY ||
    process.env.AI_EVALUATION_API_KEY.length < 32
  )
    throw new Error("evaluation_api_key_required");
  if (
    !Number.isInteger(config.port) ||
    config.port < 1024 ||
    config.port > 65535
  )
    throw new Error("invalid_evaluation_port");
  const { EvaluationModule } = await import("./evaluation.module");
  const app = await NestFactory.create<NestExpressApplication>(
    EvaluationModule,
    { logger: ["error", "warn"], bodyParser: false },
  );
  const { PrismaService } = await import("../../prisma/prisma.service");
  const prisma = app.get(PrismaService);
  const [role] = await prisma.$queryRaw<
    Array<{ current_user: string; unsafe: boolean }>
  >`SELECT current_user, (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR has_table_privilege(current_user, '"CustomerAssetBalance"', 'UPDATE')) AS unsafe FROM pg_roles WHERE rolname = current_user`;
  if (role.current_user !== "agent_eval_runtime" || role.unsafe) {
    await app.close();
    throw new Error("restricted_evaluation_database_role_required");
  }
  // Use Nest's parser with a strict body cap; no proxy headers are trusted.
  app.useBodyParser("json", { limit: "32kb", strict: true });
  app.enableShutdownHooks();
  await app.listen(config.port, config.container ? "0.0.0.0" : "127.0.0.1");
  return app;
}
if (require.main === module)
  void startEvaluationServer().catch(() => {
    console.error("Evaluation startup failed; check isolated configuration.");
    process.exitCode = 1;
  });
