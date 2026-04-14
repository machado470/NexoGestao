import { executeDecision } from "@/lib/decision-engine/execution.handler";
import type { Decision } from "@/lib/decision-engine/decision.types";
import { hasDecisionExecutionLog, logDecisionStatus } from "@/lib/decision-engine/operational-log";
import { AUTO_EXECUTION_ENABLED } from "./automation.config";
import { defaultAutomationRules } from "./automation.rules";
import type { AutomationLogEntry, AutomationRule } from "./automation.types";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function findRuleForDecision(decision: Decision, rules: AutomationRule[]) {
  return rules.find((rule) => rule.enabled && rule.condition(decision));
}

export async function runAutomation(decisions: Decision[], rules: AutomationRule[] = defaultAutomationRules): Promise<AutomationLogEntry[]> {
  const logs: AutomationLogEntry[] = [];

  for (const decision of decisions) {
    const rule = findRuleForDecision(decision, rules);
    if (!rule) continue;

    if (hasDecisionExecutionLog(decision.id)) {
      logs.push({
        rule_id: rule.id,
        decision_id: decision.id,
        timestamp: new Date().toISOString(),
        status: "skipped",
      });
      continue;
    }

    if (typeof rule.delayMs === "number" && rule.delayMs > 0) {
      logDecisionStatus(decision, "scheduled", `Automação agendada em ${rule.delayMs}ms`, { type: "automation", rule_id: rule.id });
      await wait(rule.delayMs);
      if (hasDecisionExecutionLog(decision.id)) continue;
    }

    if (!rule.autoExecute || !AUTO_EXECUTION_ENABLED) {
      logDecisionStatus(decision, "scheduled", "Automação em modo seguro: apenas sugestão registrada", { type: "automation", rule_id: rule.id });
      logs.push({
        rule_id: rule.id,
        decision_id: decision.id,
        timestamp: new Date().toISOString(),
        status: "skipped",
      });
      continue;
    }

    try {
      executeDecision(decision);
      logDecisionStatus(decision, "executed", `Executado automaticamente pela regra ${rule.name}`, { type: "automation", rule_id: rule.id });
      logs.push({
        rule_id: rule.id,
        decision_id: decision.id,
        timestamp: new Date().toISOString(),
        status: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      logDecisionStatus(decision, "error", `Falha na automação: ${message}`, { type: "automation", rule_id: rule.id });
      logs.push({
        rule_id: rule.id,
        decision_id: decision.id,
        timestamp: new Date().toISOString(),
        status: "error",
        error: message,
      });
    }
  }

  return logs;
}
