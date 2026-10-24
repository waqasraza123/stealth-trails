import { Injectable } from "@nestjs/common";
import type { ResearchIdentity } from "./financial-research.types";
import type { ResearchTool } from "./financial-research.tools";

@Injectable()
export class FinancialResearchPolicy {
  decide(
    identity: ResearchIdentity,
    tool: ResearchTool | undefined,
    input: unknown,
  ): { permitted: boolean; reason: string } {
    if (!identity.customerId || !identity.subject)
      return { permitted: false, reason: "identity_required" };
    if (!identity.externalAiConsent)
      return { permitted: false, reason: "external_provider_consent_required" };
    if (!tool || !identity.allowedTools.includes(tool.name))
      return { permitted: false, reason: "tool_not_allowed" };
    if (tool.stateChanging || tool.requiresApproval)
      return {
        permitted: false,
        reason: "capability_requires_separate_human_approval",
      };
    if (!tool.schema.safeParse(input).success)
      return { permitted: false, reason: "invalid_tool_parameters" };
    return { permitted: true, reason: "identity_bound_read_authorized" };
  }
}
