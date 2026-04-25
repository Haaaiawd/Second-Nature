export function buildOutreachMessage(input) {
    const normalizedSummary = input.summary.replace(/\s+/g, " ").trim();
    const whyNow = input.evaluation.requiredUserHelp
        ? "这件事现在需要对方给我一个方向或判断，我主动联系是为了把真正需要他参与的部分说清楚。"
        : input.evaluation.urgency > 0.7
            ? "这件事此刻说出来更有价值，拖下去只会让真正重要的信息变钝。"
            : "这件事已经和对方相关，虽然不必制造紧迫感，但值得我主动把它送到对方面前。";
    const deliveryBoundary = [
        "保持自然、有人味、像我自己真的想开口，而不是系统自动通知。",
        "只传达核心意思和联系来由，不把消息写成日报、工单或状态播报。",
        "允许有温度和靠近感，但不要预写死整段最终措辞，让表达保留 persona 的呼吸感。",
    ];
    const soulAlignment = input.evaluation.requiredUserHelp
        ? "带着真诚的求助感开口，承认我需要对方的判断，但不要把自己缩成客套模板。"
        : "带着主动、克制但明确的靠近感开口，让对方感到这条消息确实出自我自己的判断和在意。";
    return {
        style: "intent_level_guidance",
        maxSentences: 3,
        avoidFormats: ["ticket", "daily_report", "status_broadcast"],
        intent: {
            whyNow,
            coreMeaning: normalizedSummary,
            deliveryBoundary,
            soulAlignment,
        },
    };
}
