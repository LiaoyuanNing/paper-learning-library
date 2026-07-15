import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../site/data/paper_learning_mvp_sample.json", import.meta.url);
const reviewedAt = process.env.MIGRATION_REVIEWED_AT ?? new Date().toISOString();
const data = JSON.parse(await readFile(dataUrl, "utf8"));

data.schema_version = "0.2.0";
data.provenance_policy_version = "1.0.0";
data.source_model_for_ai_fields = "unknown (runtime default)";
data.records = data.records.map((record) => ({
  ...record,
  ai_generated: {
    ...record.ai_generated,
    source_model: "unknown (runtime default)",
    provider: "OpenAI",
    workflow_version: "paper-learning-mvp-seed-v1",
    input_evidence: [{
      kind: "arxiv_abstract",
      url: record.source.url,
      source_field: "abstract",
      retrieved_at: record.source.retrieved_at,
    }],
    review: {
      status: "approved",
      reviewer: "PM-Paper (AGE-23 acceptance record)",
      reviewed_at: reviewedAt,
      reason: "Historical MVP sample accepted before policy v1; migration records the published scope and preserves the source-only boundary.",
      replaces: null,
      withdrawn_by: null,
    },
    legacy_grandfathered: {
      approved: true,
      reason: "The historical static sample cannot recover an exact model slug. Policy v1 permits only the literal unknown (runtime default) value for this pre-policy artifact.",
      recorded_at: reviewedAt,
    },
  },
}));

await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Migrated ${data.records.length} historical AI records to provenance policy v1.`);
