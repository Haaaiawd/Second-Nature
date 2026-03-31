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
export declare function projectOutreachQualityAudit(input: OutreachQualityAudit): OutreachQualityProjection;
