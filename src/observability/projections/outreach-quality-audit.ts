export interface OutreachQualityAudit {
  id: string;
  valueScore: number;
  noveltyScore: number;
  requiredUserAction: boolean;
  suppressionReason?: string;
}

export interface OutreachQualityProjection {
  eventId: string;
  valueScore: number;
  noveltyScore: number;
  requiredUserAction: boolean;
  suppressionReason?: string;
}

export function projectOutreachQualityAudit(input: OutreachQualityAudit): OutreachQualityProjection {
  return {
    eventId: input.id,
    valueScore: input.valueScore,
    noveltyScore: input.noveltyScore,
    requiredUserAction: input.requiredUserAction,
    suppressionReason: input.suppressionReason,
  };
}
