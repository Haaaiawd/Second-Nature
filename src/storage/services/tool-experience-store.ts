/**
 * ToolExperienceStore + CapabilityProbeResultStore — T-SMS.C.5
 *
 * Core logic: Append-only ToolExperience rows (outcome/failureClass/latencyMs/
 * evidenceQuality/sourceRefs/triggerSource). Raw payload rejected by gate.
 * CapabilityProbeResult stored with capabilityId/actualStatus/httpStatus.
 * DR-007: failureClass directly from ConnectorResult.
 * DR-010: triggerSource mandatory.
 */

import { eq, desc, and } from "drizzle-orm";
import type { StateDatabase } from "../db/index.js";
import type { ToolExperience, CapabilityProbeResult } from "../../shared/types/v7-entities.js";
import { validateWritePayload } from "./write-validation-gate.js";

export interface ToolExperienceStore {
  appendToolExperience(exp: ToolExperience): Promise<void>;
  listToolExperience(query: { connectorId?: string; capabilityId?: string; limit?: number }): Promise<ToolExperience[]>;
}

export interface CapabilityProbeResultStore {
  appendProbeResult(result: CapabilityProbeResult): Promise<void>;
  listProbeResults(connectorId: string, limit?: number): Promise<CapabilityProbeResult[]>;
}

function safeParseJson<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export function createToolExperienceStore(database: StateDatabase): ToolExperienceStore {
  const { sqlite } = database;

  return {
    async appendToolExperience(exp: ToolExperience) {
      const gate = validateWritePayload(
        {
          ...exp,
          sourceRefs: exp.sourceRefs,
        },
        { runSensitivityScan: false },
      );
      if (!gate.ok) throw new Error(gate.reason ?? "write_validation_failed");

      sqlite.run(
        `INSERT INTO tool_experience
         (experience_id, connector_id, capability_id, outcome, failure_class,
          latency_ms, evidence_quality, source_refs_json, trigger_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
    },

    async listToolExperience(query = {}) {
      let sql = `SELECT * FROM tool_experience WHERE 1=1`;
      const params: (string | number)[] = [];
      if (query.connectorId) { sql += ` AND connector_id = ?`; params.push(query.connectorId); }
      if (query.capabilityId) { sql += ` AND capability_id = ?`; params.push(query.capabilityId); }
      sql += ` ORDER BY created_at DESC LIMIT ${query.limit ?? 100}`;

      const result = sqlite.exec(sql, params);
      if (result.length === 0 || result[0]!.values.length === 0) return [];

      const cols = result[0]!.columns;
      const get = (row: unknown[], name: string) => row[cols.indexOf(name)] as string | number | null;

      return result[0]!.values.map((row) => ({
        experienceId: get(row, "experience_id")! as string,
        connectorId: get(row, "connector_id")! as string,
        capabilityId: get(row, "capability_id")! as string,
        outcome: get(row, "outcome")! as ToolExperience["outcome"],
        failureClass: (get(row, "failure_class") as string | null) ?? undefined,
        latencyMs: get(row, "latency_ms")! as number,
        evidenceQuality: get(row, "evidence_quality")! as number,
        sourceRefs: safeParseJson<readonly [string, ...string[]]>((get(row, "source_refs_json") as string) ?? "[]", ["store:default"]),
        triggerSource: get(row, "trigger_source")! as ToolExperience["triggerSource"],
        createdAt: get(row, "created_at")! as string,
      }));
    },
  };
}

export function createCapabilityProbeResultStore(database: StateDatabase): CapabilityProbeResultStore {
  const { sqlite } = database;

  return {
    async appendProbeResult(result: CapabilityProbeResult) {
      sqlite.run(
        `INSERT INTO capability_probe_result
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
           created_at = excluded.created_at`,
        [
          result.probeResultId,
          result.capabilityId,
          result.connectorId,
          result.actualStatus,
          result.httpStatus ?? null,
          result.sampleResponseRef ?? null,
          result.probeConfigRef,
          result.createdAt,
        ],
      );
    },

    async listProbeResults(connectorId: string, limit = 10) {
      const result = sqlite.exec(
        `SELECT * FROM capability_probe_result
         WHERE connector_id = ?
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        [connectorId],
      );
      if (result.length === 0 || result[0]!.values.length === 0) return [];

      const cols = result[0]!.columns;
      const get = (row: unknown[], name: string) => row[cols.indexOf(name)] as string | number | null;

      return result[0]!.values.map((row) => ({
        probeResultId: get(row, "probe_result_id")! as string,
        capabilityId: get(row, "capability_id")! as string,
        connectorId: get(row, "connector_id")! as string,
        actualStatus: get(row, "actual_status")! as CapabilityProbeResult["actualStatus"],
        httpStatus: (get(row, "http_status") as number | null) ?? undefined,
        sampleResponseRef: (get(row, "sample_response_ref") as string | null) ?? undefined,
        probeConfigRef: get(row, "probe_config_ref")! as string,
        createdAt: get(row, "created_at")! as string,
      }));
    },
  };
}
