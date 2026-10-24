import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
  Header,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { z } from "zod";
import { AgentObservatoryService } from "../agent-observatory.service";
import { FinancialResearchService } from "../financial-research.service";
import { researchRequestSchema } from "../financial-research.types";
import {
  assertEvaluationEnvironment,
  evaluationSubject,
  EVALUATION_FIXTURE_VERSION,
  isPrivateEvaluationPeer,
} from "./evaluation.config";

type EvaluationRequest = {
  headers: { authorization?: string };
  socket: { remoteAddress?: string };
  evaluationSubject: string;
  on: (name: string, callback: () => void) => void;
  off: (name: string, callback: () => void) => void;
};
@Injectable()
export class EvaluationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    assertEvaluationEnvironment();
    const request = context.switchToHttp().getRequest<EvaluationRequest>();
    const subject = evaluationSubject(request.headers.authorization);
    if (!subject || !isPrivateEvaluationPeer(request.socket.remoteAddress))
      throw new UnauthorizedException("Evaluation authentication required.");
    const marker = await this.prisma.auditEvent.findUnique({
      where: { id: "agent-evaluation-fixture-manifest" },
      select: { metadata: true },
    });
    if (
      !marker ||
      !z
        .object({
          version: z.literal(EVALUATION_FIXTURE_VERSION),
          synthetic: z.literal(true),
          subjects: z.tuple([
            z.literal("eval-aurora"),
            z.literal("eval-boreal"),
          ]),
        })
        .safeParse(marker.metadata).success
    )
      throw new UnauthorizedException("Evaluation fixtures unavailable.");
    request.evaluationSubject = subject;
    return true;
  }
}

@UseGuards(EvaluationGuard)
@Controller("internal/ai-agent-evaluation")
export class EvaluationController {
  constructor(
    private readonly research: FinancialResearchService,
    private readonly observatory: AgentObservatoryService,
    private readonly prisma: PrismaService,
  ) {}
  @Get("metadata")
  @Header("Cache-Control", "no-store")
  metadata() {
    return {
      ...this.research.configuration(),
      fixtureVersion: EVALUATION_FIXTURE_VERSION,
      synthetic: true,
    };
  }
  @Post("execute")
  @Header("Cache-Control", "no-store")
  async execute(@Request() request: EvaluationRequest, @Body() body: unknown) {
    const input = researchRequestSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException(
        "Expected only prompt (1–16000 characters) and optional runId.",
      );
    const abort = new AbortController();
    const interrupt = () => abort.abort();
    request.on("aborted", interrupt);
    try {
      return await this.research.execute(
        request.evaluationSubject,
        input.data,
        true,
        abort.signal,
      );
    } finally {
      request.off("aborted", interrupt);
    }
  }
  @Get("traces/:executionId")
  @Header("Cache-Control", "no-store")
  async trace(
    @Request() request: EvaluationRequest,
    @Param("executionId") executionId: string,
  ) {
    if (!/^[a-f0-9-]{36}$/u.test(executionId))
      throw new BadRequestException("Invalid execution ID.");
    const customer = await this.prisma.customer.findUnique({
      where: { supabaseUserId: request.evaluationSubject },
      select: { id: true },
    });
    const trace = customer
      ? await this.observatory.getResearchExecution(customer.id, executionId)
      : null;
    if (!trace) throw new NotFoundException("Execution unavailable.");
    return trace;
  }
}
