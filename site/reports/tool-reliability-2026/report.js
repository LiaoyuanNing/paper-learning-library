const el = (tag, { text, className, attrs } = {}) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  return node;
};

function evidenceLinks(claim, evidence, sources) {
  const wrap = el("span", { className: "citations" });
  for (const id of claim.supporting_evidence_ids) {
    const item = evidence.get(id); const source = sources.get(item.source_id);
    wrap.append(el("a", { text: `${id} · ${source.source_id}`, className: "citation", attrs: { href: source.official_url, target: "_blank", rel: "noreferrer" } }));
  }
  return wrap;
}

function render(manifest) {
  const evidence = new Map(manifest.evidence.map((item) => [item.evidence_id, item]));
  const sources = new Map(manifest.sources.map((item) => [item.source_id, item]));
  document.querySelector("#knowledge-cutoff").textContent = manifest.request.knowledge_cutoff;
  document.querySelector("#source-count").textContent = `${manifest.sources.length} 篇`;
  document.querySelector("#snapshot-digest").textContent = manifest.snapshot_digest.slice(0, 19) + "…";
  document.querySelector("#model-disclosure").textContent = `AI 辅助综合：${manifest.ai_provenance.provider} / ${manifest.ai_provenance.source_model}；已由 PM-Paper 审核。`;
  document.querySelector("#footer-version").textContent = `Manifest ${manifest.manifest_version} · ${manifest.snapshot_digest.slice(0, 19)}…`;

  const findings = document.querySelector("#findings-list");
  for (const claim of manifest.claims.filter((item) => item.type === "direct_answer")) {
    const row = el("li", { className: `finding strength-${claim.strength}` });
    row.append(el("span", { text: `${claim.claim_id} · ${claim.strength}`, className: "claim-id" }), el("p", { text: claim.text }), el("p", { text: `边界：${claim.scope}`, className: "scope" }), evidenceLinks(claim, evidence, sources));
    findings.append(row);
  }
  const recommendations = document.querySelector("#recommendations-list");
  for (const claim of manifest.claims.filter((item) => item.type === "product_recommendation")) {
    const row = el("li"); row.append(el("h3", { text: claim.title }), el("p", { text: claim.text }), el("p", { text: `副作用：${claim.side_effects}`, className: "scope" }), evidenceLinks(claim, evidence, sources)); recommendations.append(row);
  }
  const grid = document.querySelector("#source-grid");
  for (const source of manifest.sources) {
    const card = el("article", { className: "source-card" });
    card.append(el("span", { text: `${source.source_id} · ${source.arxiv_id}${source.version}`, className: "claim-id" }), el("h3", { text: source.title }), el("p", { text: source.role }), el("p", { text: `${source.publication_status} · ${source.venue_status}`, className: "scope" }), el("a", { text: "打开一手来源", attrs: { href: source.official_url, target: "_blank", rel: "noreferrer" } })); grid.append(card);
  }
  const method = document.querySelector("#method-copy"); for (const paragraph of manifest.report.method) method.append(el("p", { text: paragraph }));
  const questions = document.querySelector("#consumer-questions"); for (const item of manifest.consumer_contract.questions) questions.append(el("li", { text: item.question }));
  const limitations = document.querySelector("#limitations"); for (const item of manifest.report.limitations) limitations.append(el("li", { text: item }));
}

fetch("./data/evidence-manifest.v1.json").then((response) => {
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`); return response.json();
}).then(render).catch(() => document.querySelector("#findings-list").append(el("li", { text: "证据包加载失败；请直接打开 JSON manifest。", className: "load-error" })));
