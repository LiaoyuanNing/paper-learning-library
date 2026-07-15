const byId = (items) => new Map(items.map((item) => [item.id, item]));

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(name, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function appendText(target, tag, text, className) {
  const node = element(tag, { text, className });
  target.append(node);
  return node;
}

function renderReport(manifest) {
  const sources = byId(manifest.sources.map((source) => ({ ...source, id: source.source_id })));
  const evidence = byId(manifest.evidence.map((item) => ({ ...item, id: item.evidence_id })));
  const claims = byId(manifest.claims.map((claim) => ({ ...claim, id: claim.claim_id })));

  document.querySelector("#knowledge-cutoff").textContent = manifest.request.knowledge_cutoff;
  document.querySelector("#paper-count").textContent = `${manifest.papers.filter((paper) => paper.selection.decision === "included").length} 篇`;
  document.querySelector("#model-disclosure").textContent = `${manifest.outputs.model_disclosure} · 生成于 ${manifest.outputs.generated_at.slice(0, 10)}`;
  document.querySelector("#footer-version").textContent = `Manifest ${manifest.manifest_version} · ${manifest.snapshot_digest.slice(0, 19)}…`;

  const citationsFor = (claim) => {
    const citations = element("div", { className: "citations" });
    const seen = new Set();
    for (const evidenceId of claim.supporting_evidence_ids) {
      const item = evidence.get(evidenceId);
      const source = item && sources.get(item.source_id);
      if (!source || seen.has(source.source_id)) continue;
      seen.add(source.source_id);
      citations.append(element("a", {
        className: "citation",
        text: `[${source.paper_id}]`,
        attrs: { href: source.official_url, target: "_blank", rel: "noreferrer", title: `${source.title} · ${item.locator}` },
      }));
    }
    return citations;
  };

  const strengthLabels = {
    strong: "证据相对较强",
    conditional: "有条件成立",
    contested: "仍有争议 / 探索性",
  };
  const summaryRoot = document.querySelector("#summary-groups");
  for (const strength of ["strong", "conditional", "contested"]) {
    const section = element("article", { className: "summary-group", attrs: { "data-strength": strength } });
    appendText(section, "h3", strengthLabels[strength]);
    const list = element("ol", { className: "claim-list" });
    for (const claim of manifest.claims.filter((item) => item.show_in_summary && item.strength === strength)) {
      const row = element("li", { className: "claim" });
      const copy = element("p");
      copy.append(element("span", { className: "claim-id", text: claim.claim_id }), document.createTextNode(claim.text));
      row.append(copy, element("p", { className: "claim-scope", text: `边界：${claim.scope}` }), citationsFor(claim));
      list.append(row);
    }
    section.append(list);
    summaryRoot.append(section);
  }

  const counterList = document.querySelector("#counter-list");
  for (const item of manifest.report.counterintuitive) counterList.append(element("li", { text: item }));

  const timeline = document.querySelector("#timeline");
  for (const item of manifest.report.timeline) {
    const row = element("li");
    row.append(element("time", { text: item.period }), element("h3", { text: item.title }), element("p", { text: item.text }));
    timeline.append(row);
  }

  const taxonomy = document.querySelector("#taxonomy");
  manifest.report.taxonomy.forEach((item, index) => {
    const card = element("article", { className: "taxonomy-card" });
    card.append(
      element("span", { className: "index", text: String(index + 1).padStart(2, "0") }),
      element("h3", { text: item.title }),
      element("p", { text: item.text }),
      element("p", { className: "question", text: item.question }),
    );
    taxonomy.append(card);
  });

  const matrix = document.querySelector("#consensus-matrix");
  for (const row of manifest.report.consensus_matrix) {
    const tr = element("tr");
    tr.append(
      element("td", { text: row.topic }),
      element("td", { text: row.consensus }),
      element("td", { text: row.unknown }),
      element("td", { text: row.claim_ids.join(" · ") }),
    );
    matrix.append(tr);
  }

  const paperGrid = document.querySelector("#paper-grid");
  const includedPapers = manifest.papers.filter((paper) => paper.selection.decision === "included");
  for (const paper of includedPapers) {
    const source = sources.get(paper.source_id);
    const card = element("article", { className: "research-card", attrs: { "data-group": paper.group } });
    const topline = element("div", { className: "paper-topline" });
    topline.append(
      element("span", { text: `${paper.paper_id} · ${paper.group === "foundation" ? "奠基 / 典型" : "前沿"}` }),
      element("span", { className: `status-badge${source.publication_status === "preprint" ? " preprint" : ""}`, text: source.publication_status }),
    );
    const title = element("h3");
    title.append(element("a", { text: source.title, attrs: { href: source.official_url, target: "_blank", rel: "noreferrer" } }));
    const fields = element("dl", { className: "paper-fields" });
    for (const [label, value] of [["机制", paper.mechanism], ["实验", paper.experiment], ["结果", paper.result]]) {
      const group = element("div");
      group.append(element("dt", { text: label }), element("dd", { text: value }));
      fields.append(group);
    }
    card.append(
      topline,
      title,
      element("p", { className: "paper-authors", text: `${source.authors.join("、")} · ${source.year}` }),
      fields,
      element("p", { className: "paper-limit", text: `边界｜${paper.limitations}` }),
    );
    paperGrid.append(card);
  }

  const recommendations = document.querySelector("#recommendations");
  for (const recommendation of manifest.claims.filter((claim) => claim.type === "recommendation")) {
    const row = element("li");
    row.append(element("h3", { text: recommendation.title }), element("p", { text: recommendation.text }));
    for (const [label, value] of [["证据依据", recommendation.evidence_basis], ["适用前提", recommendation.assumptions], ["副作用 / 风险", recommendation.side_effects]]) {
      const copy = element("p");
      copy.append(element("strong", { text: `${label}：` }), document.createTextNode(value));
      row.append(copy);
    }
    row.append(citationsFor(recommendation));
    recommendations.append(row);
  }

  const methodCopy = document.querySelector("#method-copy");
  for (const paragraph of manifest.report.method) methodCopy.append(element("p", { text: paragraph }));
  const loop = document.querySelector("#episode-loop");
  for (const item of manifest.report.episode_loop) loop.append(element("li", { text: item }));

  const references = document.querySelector("#references");
  for (const source of manifest.sources) {
    const row = element("li");
    const link = element("a", { text: source.title, attrs: { href: source.official_url, target: "_blank", rel: "noreferrer" } });
    row.append(
      link,
      document.createTextNode(` — ${source.authors.join(", ")} (${source.year})`),
      element("span", { className: "reference-meta", text: `${source.paper_id} · ${source.version} · ${source.publication_status} · 访问 ${source.accessed_at}` }),
    );
    references.append(row);
  }

  const limitations = document.querySelector("#limitations-list");
  for (const item of manifest.report.limitations) limitations.append(element("li", { text: item }));

  for (const id of manifest.report.claim_links) {
    if (!claims.has(id)) throw new Error(`Report points to missing claim: ${id}`);
  }
}

async function start() {
  const response = await fetch("./data/evidence-manifest.v1.json");
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  renderReport(await response.json());
}

start().catch(() => {
  document.querySelector("#summary-groups").append(element("p", {
    className: "load-error",
    text: "证据包加载失败。请稍后重试，或直接打开页面顶部的 JSON 证据包。",
  }));
});
