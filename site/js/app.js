const PUBLIC_AI_MODEL = "unknown (runtime default)";
const DATASET_SOURCE = "AGE-23 · paper_learning_mvp_seed_v1";

const reader = document.querySelector("#reader");
const resultSummary = document.querySelector("#result-summary");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const tagFilter = document.querySelector("#tag-filter");
const filters = document.querySelector("#filters");

let records = [];
let filtersState = { query: "", category: "", tag: "" };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "未提供";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}

function externalLink(label, href) {
  if (!href) return "";
  return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a></li>`;
}

function recordMatches(record) {
  const searchSpace = `${record.title} ${record.authors.join(" ")}`.toLocaleLowerCase();
  const query = filtersState.query.trim().toLocaleLowerCase();
  return (!query || searchSpace.includes(query))
    && (!filtersState.category || record.categories.includes(filtersState.category))
    && (!filtersState.tag || record.tags.includes(filtersState.tag));
}

function currentPaperId() {
  return new URLSearchParams(window.location.search).get("paper");
}

function setFiltersVisible(visible) {
  filters.hidden = !visible;
  resultSummary.hidden = !visible;
}

function renderList() {
  document.title = "论文学习库 · Paper Notes";
  setFiltersVisible(true);
  const filtered = records.filter(recordMatches);
  resultSummary.innerHTML = `显示 <strong>${filtered.length}</strong> / ${records.length} 篇论文`;

  if (!filtered.length) {
    reader.innerHTML = `<div class="empty-state"><h2>没有匹配的论文</h2><p>试试更换关键词，或清除分类和主题筛选。</p></div>`;
    return;
  }

  reader.innerHTML = `<div class="paper-grid">${filtered.map((record) => `
    <article class="paper-card">
      <div class="card-topline"><span class="arxiv-id">arXiv:${escapeHtml(record.arxiv_id)}</span><span>${escapeHtml(record.primary_category)}</span></div>
      <h2 class="card-title"><a href="?paper=${encodeURIComponent(record.arxiv_id)}" data-paper-id="${escapeHtml(record.arxiv_id)}">${escapeHtml(record.title)}</a></h2>
      <p class="authors">${escapeHtml(record.authors.join(" · "))}</p>
      <ul class="tag-list">${record.tags.slice(0, 3).map((tag) => `<li class="tag">#${escapeHtml(tag)}</li>`).join("")}</ul>
      <a class="card-link" href="?paper=${encodeURIComponent(record.arxiv_id)}" data-paper-id="${escapeHtml(record.arxiv_id)}">阅读学习卡片 <span aria-hidden="true">→</span></a>
    </article>`).join("")}</div>`;
}

function renderDetail(record) {
  setFiltersVisible(false);
  resultSummary.textContent = "";
  const ai = record.ai_generated;
  const fullTextStored = record.copyright?.full_text_stored === true;
  document.title = `${record.title} · 论文学习库`;

  reader.innerHTML = `<article class="detail">
    <button class="back-button" type="button" id="back-to-list">← 返回全部论文</button>
    <header class="detail-header">
      <div class="detail-kicker"><span class="arxiv-id">arXiv:${escapeHtml(record.arxiv_id)}${escapeHtml(record.arxiv_version || "")}</span><span>${escapeHtml(record.categories.join(" · "))}</span></div>
      <h2>${escapeHtml(record.title)}</h2>
      <p class="detail-authors">${escapeHtml(record.authors.join(" · "))}</p>
    </header>
    <div class="detail-columns">
      <section class="content-section" aria-labelledby="original-heading">
        <p class="section-label">arXiv 原始信息</p>
        <h3 id="original-heading">原始摘要与来源</h3>
        <dl>
          <dt>主分类</dt><dd>${escapeHtml(record.primary_category)}</dd>
          <dt>全部分类</dt><dd>${escapeHtml(record.categories.join(" · "))}</dd>
          <dt>首次发布</dt><dd>${formatDate(record.published_at)}</dd>
          <dt>最近更新</dt><dd>${formatDate(record.updated_at)}</dd>
        </dl>
        <h4>Abstract</h4>
        <p>${escapeHtml(record.abstract)}</p>
        <ul class="external-links" aria-label="原文链接">
          ${externalLink("arXiv 原始页", record.links?.abstract)}
          ${externalLink("PDF", record.links?.pdf)}
          ${externalLink("DOI", record.links?.doi)}
        </ul>
        <div class="disclosure">
          <p><strong>版权姿态：</strong>full_text_stored=${fullTextStored}; 本页不存储或渲染论文全文。</p>
          <p>原始来源：<a href="${escapeHtml(record.source?.url)}" target="_blank" rel="noreferrer">arXiv</a>；检索于 ${formatDate(record.source?.retrieved_at)}。</p>
        </div>
      </section>
      <section class="content-section ai-section" aria-labelledby="ai-heading">
        <p class="section-label">AI 生成内容</p>
        <h3 id="ai-heading">中文学习摘要</h3>
        <p>${escapeHtml(ai.abstract_zh)}</p>
        <h4>学习亮点</h4>
        <ol class="highlights">${ai.learning_highlights_zh.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("")}</ol>
        <div class="disclosure">
          <p><strong>生成时间：</strong>${formatDate(ai.generated_at)}</p>
          <p><strong>模型来源：</strong>${PUBLIC_AI_MODEL}</p>
          <p><strong>数据集来源：</strong>${DATASET_SOURCE}</p>
          <p>说明：历史数据不能恢复精确模型 slug，故不做推测；以上中文摘要和亮点均为 AI 生成内容。</p>
        </div>
      </section>
    </div>
  </article>`;

  document.querySelector("#back-to-list").addEventListener("click", () => {
    history.pushState({}, "", window.location.pathname);
    renderRoute();
    document.querySelector("#main-content").focus();
  });
}

function renderRoute() {
  const paperId = currentPaperId();
  const record = records.find((item) => item.arxiv_id === paperId);
  if (paperId && record) {
    renderDetail(record);
    return;
  }
  renderList();
}

function populateFilters() {
  const categories = [...new Set(records.flatMap((record) => record.categories))].sort();
  const tags = [...new Set(records.flatMap((record) => record.tags))].sort();
  categoryFilter.insertAdjacentHTML("beforeend", categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));
  tagFilter.insertAdjacentHTML("beforeend", tags.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));
}

function showLoadError() {
  setFiltersVisible(false);
  reader.setAttribute("aria-busy", "false");
  reader.innerHTML = `<div class="load-error"><h2>数据未能加载</h2><p>请通过静态服务器打开此页面，例如运行 <code>npm run preview</code>，而不是直接双击 HTML 文件。</p></div>`;
}

function updateFilters() {
  filtersState = { query: searchInput.value, category: categoryFilter.value, tag: tagFilter.value };
  renderList();
}

searchInput.addEventListener("input", updateFilters);
categoryFilter.addEventListener("change", updateFilters);
tagFilter.addEventListener("change", updateFilters);
reader.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-paper-id]");
  if (!link) return;
  event.preventDefault();
  history.pushState({}, "", `${window.location.pathname}?paper=${encodeURIComponent(link.dataset.paperId)}`);
  renderRoute();
  document.querySelector("#main-content").focus();
});
window.addEventListener("popstate", renderRoute);

async function start() {
  try {
    const response = await fetch("./data/paper_learning_mvp_sample.json");
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    const data = await response.json();
    records = data.records;
    populateFilters();
    renderRoute();
  } catch (error) {
    console.error(error);
    showLoadError();
  } finally {
    reader.setAttribute("aria-busy", "false");
  }
}

start();
