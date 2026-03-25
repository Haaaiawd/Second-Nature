import type { OutreachEvaluationResult } from "../../../shared/types/outreach.js";

export interface OutreachMessage {
  style: "conversational_micro_message";
  maxSentences: 3;
  avoidFormats: Array<"ticket" | "daily_report" | "status_broadcast">;
  text: string;
}

export function buildOutreachMessage(input: {
  summary: string;
  evaluation: OutreachEvaluationResult;
}): OutreachMessage {
  const prefix = input.evaluation.requiredUserHelp
    ? "想请你帮我确认一件事："
    : "给你一个简短更新：";

  const sentences: string[] = [];
  sentences.push(`${prefix}${input.summary.replace(/\s+/g, " ").trim()}`);

  if (input.evaluation.requiredUserHelp) {
    sentences.push("如果你有 1 分钟，给我一个方向就好。");
  } else if (input.evaluation.urgency > 0.7) {
    sentences.push("这件事现在处理收益更高。");
  } else {
    sentences.push("不着急，你方便时看一眼即可。");
  }

  const text = sentences.slice(0, 3).join(" ");

  return {
    style: "conversational_micro_message",
    maxSentences: 3,
    avoidFormats: ["ticket", "daily_report", "status_broadcast"],
    text,
  };
}
