import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

function canonical(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${canonical(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function fixture() {
  const bundle = {
    format: "composition-pipeline.blinded-review", version: 1,
    campaign_digest: "campaign-digest",
    pairs: [
      { pair_id: "pair-one", case_id: "case-1", prompt_style: "concise", repetition: 0,
        task: "Improve this.", draft: "Rough.", candidate_a: "Alpha.", candidate_b: "Beta.",
        criteria: ["clarity"] },
      { pair_id: "pair-two", case_id: "case-2", prompt_style: "preserve", repetition: 0,
        task: "Fix this.", draft: "Wrong.", candidate_a: "Gamma.", candidate_b: "Delta.",
        criteria: ["clarity"] },
    ],
  };
  const key = {
    format: "composition-pipeline.blinded-review-key", version: 1,
    campaign_digest: bundle.campaign_digest,
    review_bundle_digest: createHash("sha256").update(canonical(bundle)).digest("hex"),
    pairs: [
      { pair_id: "pair-one", candidate_a_arm: "direct_rewrite", candidate_b_arm: "schema_revision" },
      { pair_id: "pair-two", candidate_a_arm: "schema_revision", candidate_b_arm: "direct_rewrite" },
    ],
  };
  return { bundle, key };
}

export async function writeFixture(directory) {
  const { bundle, key } = fixture();
  const bundlePath = `${directory}/bundle.json`; const keyPath = `${directory}/key.json`;
  await Promise.all([
    writeFile(bundlePath, JSON.stringify(bundle)), writeFile(keyPath, JSON.stringify(key)),
  ]);
  return { bundlePath, keyPath, bundle, key };
}
