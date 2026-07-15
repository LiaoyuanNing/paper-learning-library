import { readFile } from "node:fs/promises";
import { validatePublishedGovernance, validatePublicDataset } from "./governance-validator.mjs";

const data = JSON.parse(await readFile(new URL("../site/data/paper_learning_mvp_sample.json", import.meta.url), "utf8"));

validatePublicDataset(data, "paper_learning_mvp_sample.json");
await validatePublishedGovernance(process.cwd());

console.log(`Validated ${data.records.length} records, public publish gates, and immutable AGE-174 governance binding.`);
