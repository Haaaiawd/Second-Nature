/**
 * ToolExperienceStore + CapabilityProbeResultStore — T-SMS.C.5
 *
 * Core logic: Append-only ToolExperience rows (outcome/failureClass/latencyMs/
 * evidenceQuality/sourceRefs/triggerSource). Raw payload rejected by gate.
 * CapabilityProbeResult stored with capabilityId/actualStatus/httpStatus.
 * DR-007: failureClass directly from ConnectorResult.
 * DR-010: triggerSource mandatory.
 */
import { validateWritePayload } from "./write-validation-gate.js";
function safeParseJson(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
export function createToolExperienceStore(database) {
    const { sqlite } = database;
    return {
        async appendToolExperience(exp) {
            const gate = validateWritePayload({
                ...exp,
                sourceRefs: exp.sourceRefs,
            }, { runSensitivityScan: false });
            if (!gate.ok)
                throw new Error(gate.reason ?? "write_validation_failed");
            sqlite.run(`INSERT INTO tool_experience
         (experience_id, connector_id, capability_id, outcome, failure_class,
          latency_ms, evidence_quality, source_refs_json, trigger_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                exp.experienceId,
                exp.connectorId,
                exp.capabilityId,
                exp.outcome,
                exp.failureClass ?? null,
                exp.latencyMs,
                exp.evidenceQuality,
                JSON.stringify(exp.sourceRefs),
                exp.triggerSource,
                exp.createdAt,
            ]);
        },
        async listToolExperience(query = {}) {
            let sql = `SELECT * FROM tool_experience WHERE 1=1`;
            const params = [];
            if (query.connectorId) {
                sql += ` AND connector_id = ?`;
                params.push(query.connectorId);
            }
            if (query.capabilityId) {
                sql += ` AND capability_id = ?`;
                params.push(query.capabilityId);
            }
            sql += ` ORDER BY created_at DESC LIMIT ${query.limit ?? 100}`;
            const result = sqlite.exec(sql, params);
            if (result.length === 0 || result[0].values.length === 0)
                return [];
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                experienceId: get(row, "experience_id"),
                connectorId: get(row, "connector_id"),
                capabilityId: get(row, "capability_id"),
                outcome: get(row, "outcome"),
                failureClass: get(row, "failure_class") ?? undefined,
                latencyMs: get(row, "latency_ms"),
                evidenceQuality: get(row, "evidence_quality"),
                sourceRefs: safeParseJson(get(row, "source_refs_json") ?? "[]", ["store:default"]),
                triggerSource: get(row, "trigger_source"),
                createdAt: get(row, "created_at"),
            }));
        },
    };
}
export function createCapabilityProbeResultStore(database) {
    const { sqlite } = database;
    return {
        async appendProbeResult(result) {
            sqlite.run(`INSERT INTO capability_probe_result
         (probe_result_id, capability_id, connector_id, actual_status,
          http_status, sample_response_ref, probe_config_ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(probe_result_id) DO UPDATE SET
           capability_id = excluded.capability_id,
           connector_id = excluded.connector_id,
           actual_status = excluded.actual_status,
           http_status = excluded.http_status,
           sample_response_ref = excluded.sample_response_ref,
           probe_config_ref = excluded.probe_config_ref,
           created_at = excluded.created_at`, [
                result.probeResultId,
                result.capabilityId,
                result.connectorId,
                result.actualStatus,
                result.httpStatus ?? null,
                result.sampleResponseRef ?? null,
                result.probeConfigRef,
                result.createdAt,
            ]);
        },
        async listProbeResults(connectorId, limit = 10) {
            const result = sqlite.exec(`SELECT * FROM capability_probe_result
         WHERE connector_id = ?
         ORDER BY created_at DESC
         LIMIT ${limit}`, [connectorId]);
            if (result.length === 0 || result[0].values.length === 0)
                return [];
            const cols = result[0].columns;
            const get = (row, name) => row[cols.indexOf(name)];
            return result[0].values.map((row) => ({
                probeResultId: get(row, "probe_result_id"),
                capabilityId: get(row, "capability_id"),
                connectorId: get(row, "connector_id"),
                actualStatus: get(row, "actual_status"),
                httpStatus: get(row, "http_status") ?? undefined,
                sampleResponseRef: get(row, "sample_response_ref") ?? undefined,
                probeConfigRef: get(row, "probe_config_ref"),
                createdAt: get(row, "created_at"),
            }));
        },
    };
}
