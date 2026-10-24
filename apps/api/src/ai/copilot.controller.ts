import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CopilotService } from "./copilot.service";
import type {
  CopilotConversation,
  CopilotDashboard,
  CopilotTurnResult,
} from "./copilot.types";
import { SendCopilotMessageDto } from "./dto/send-copilot-message.dto";
import { AgentObservatoryService } from "./agent-observatory.service";
import { summarizeCopilotRun } from "./agent-observatory.summaries";
import { FinancialResearchService } from "./financial-research.service";
import { researchRequestSchema } from "./financial-research.types";
import { z } from "zod";

type AuthenticatedRequest = { user: { id: string } };
type StreamingResponse = {
  status(code: number): StreamingResponse;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(chunk?: string): void;
  headersSent: boolean;
};

@UseGuards(JwtAuthGuard)
@Controller("ai/copilot")
export class CopilotController {
  constructor(
    private readonly copilot: CopilotService,
    private readonly observatory: AgentObservatoryService,
    private readonly research: FinancialResearchService,
  ) {}

  @Post("research")
  async researchRequest(@Request() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = researchRequestSchema.extend({ externalAiOptIn: z.boolean() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid research request.");
    const { externalAiOptIn, ...input } = parsed.data;
    return this.research.execute(request.user.id, input, externalAiOptIn);
  }

  @Get()
  async dashboard(
    @Request() request: AuthenticatedRequest,
  ): Promise<CustomJsonResponse<CopilotDashboard>> {
    return {
      status: "success",
      message: "AI Financial Copilot workspace retrieved successfully.",
      data: await this.copilot.getDashboard(request.user.id),
    };
  }

  @Get("conversations/:conversationId")
  async conversation(
    @Request() request: AuthenticatedRequest,
    @Param("conversationId") conversationId: string,
  ): Promise<CustomJsonResponse<CopilotConversation>> {
    return {
      status: "success",
      message: "Copilot conversation retrieved successfully.",
      data: await this.copilot.getConversation(request.user.id, conversationId),
    };
  }

  @Post("messages")
  async message(
    @Request() request: AuthenticatedRequest,
    @Body() dto: SendCopilotMessageDto,
  ): Promise<CustomJsonResponse<CopilotTurnResult>> {
    return {
      status: "success",
      message: "Copilot response generated successfully.",
      data: await this.observatory.observeCustomer(request.user.id, {
        agentId: "financial-copilot",
        workflow: "answer_copilot_message",
        execute: () => this.copilot.sendMessage(request.user.id, {
          conversationId: dto.conversationId,
          message: dto.message,
          externalAiOptIn: dto.externalAiOptIn === true,
          approveMemoryChange: dto.approveMemoryChange === true,
          searchDocuments: dto.searchDocuments === true,
          documentId: dto.documentId,
          portfolioRiskContext: dto.portfolioRiskContext,
        }),
        summarize: summarizeCopilotRun,
      }),
    };
  }

  @Post("messages/stream")
  async streamMessage(
    @Request() request: AuthenticatedRequest,
    @Body() dto: SendCopilotMessageDto,
    @Res() response: StreamingResponse,
  ): Promise<void> {
    try {
      const result = await this.observatory.observeCustomer(request.user.id, {
        agentId: "financial-copilot",
        workflow: "stream_copilot_message",
        execute: () => this.copilot.sendMessage(request.user.id, {
          conversationId: dto.conversationId,
          message: dto.message,
          externalAiOptIn: dto.externalAiOptIn === true,
          approveMemoryChange: dto.approveMemoryChange === true,
          searchDocuments: dto.searchDocuments === true,
          documentId: dto.documentId,
          portfolioRiskContext: dto.portfolioRiskContext,
        }),
        summarize: summarizeCopilotRun,
      });
      response.status(200);
      response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      response.setHeader("Cache-Control", "no-store, no-transform");
      response.setHeader("X-Accel-Buffering", "no");
      response.write(
        `${JSON.stringify({
          type: "meta",
          conversation: result.conversation,
          messageId: result.message.id,
          mode: result.message.mode,
        })}\n`,
      );
      const chunks = result.message.content.match(/[\s\S]{1,96}/gu) ?? [
        result.message.content,
      ];
      for (const content of chunks) {
        response.write(`${JSON.stringify({ type: "delta", content })}\n`);
      }
      response.end(`${JSON.stringify({ type: "done", result })}\n`);
    } catch (error) {
      if (response.headersSent) {
        response.end(
          `${JSON.stringify({
            type: "error",
            message: "The copilot response could not be completed.",
          })}\n`,
        );
        return;
      }
      throw error;
    }
  }
}
