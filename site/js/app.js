import { REVIEW_STATUSES, READING_STATES, StudyStore } from "./study-store.js";
import { EMPTY_FILTERS, listCustomTags, recordMatchesFilters } from "./study-filters.js";
import { escapeHtml, safeMultilineHtml } from "./safe-html.js";

const PUBLIC_AI_MODEL = "unknown (runtime default)";
const DATASET_SOURCE = "AGE-23 · paper_learning_mvp_seed_v1";
const READING_STATE_LABELS = { queued: "待阅读", reading: "阅读中", read: "已读", archived: "已归档" };
const REVIEW_STATUS_LABELS = { unreviewed: "未审核", accepted: "已接受", needs_edit: "需编辑", rejected: "已拒绝" };

const reader = document.querySelector("#reader");
const resultSummary = document.querySelector("#result-summary");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const topicFilter = document.querySelector("#topic-filter");
const customTagFilter = document.querySelector("#custom-tag-filter");
const readingStateFilter = document.querySelector("#reading-state-filter");
const savedViewSelect = document.querySelector("#saved-view-select");
const savedViewName = document.querySelector("#saved-view-name");
const filters = document.querySelector("#filters");
const savedViews = document.querySelector("#saved-views");
const storageNotice = document.querySelector("#storage-notice");

let records = [];
let filtersState = { ...EMPTY_FILTERS };
let selectedViewId = "";
let editingNoteId = "";
const studyStore = new StudyStore({ storage: (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})() });

function formatDate(value) {
  if (!value) return "未提供";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "未审核";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function externalLink(label, href) {
  if (!href) return "";
  return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a></li>`;
}

function selectOptions(placeholder, values, selected, labels = {}) {
  return `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(labels[value] ?? value)}</option>`).join("")}`;
}

function currentPaperId() {
  return new URLSearchParams(window.location.search).get("paper");
}

function setFiltersVisible(visible) {
  filters.hidden = !visible;
  savedViews.hidden = !visible;
  resultSummary.hidden = !visible;
}

function setSelectOptions(select, placeholder, values, selected, labels) {
  select.innerHTML = selectOptions(placeholder, values, selected, labels);
}

function populateSourceFilters() {
  const categories = [...new Set(records.flatMap((record) => record.categories))].sort();
  const topics = [...new Set(records.flatMap((record) => record.tags))].sort();
  setSelectOptions(categoryFilter, "全部分类", categories, filtersState.category);
  setSelectOptions(topicFilter, "全部来源主题", topics, filtersState.topic);
  setSelectOptions(readingStateFilter, "全部阅读状态", READING_STATES, filtersState.readingState, READING_STATE_LABELS);
}

function populatePersonalFilters() {
  const tags = listCustomTags(studyStore);
  if (filtersState.customTag && !tags.includes(filtersState.customTag)) filtersState.customTag = "";
  setSelectOptions(customTagFilter, "全部自定义标签", tags, filtersState.customTag);
}

function renderSavedViews() {
  const views = studyStore.data.saved_views;
  if (selectedViewId && !views.some((view) => view.id === selectedViewId)) selectedViewId = "";
  savedViewSelect.innerHTML = selectOptions("选择已保存的筛选", views.map((view) => view.id), selectedViewId, Object.fromEntries(views.map((view) => [view.id, view.name])));
  document.querySelector("#rename-saved-view").disabled = !selectedViewId;
  document.querySelector("#delete-saved-view").disabled = !selectedViewId;
}

function syncFilterControls() {
  searchInput.value = filtersState.query;
  populateSourceFilters();
  populatePersonalFilters();
}

function readingStateControl(record) {
  const state = studyStore.getPaper(record.arxiv_id).reading_state ?? "";
  return `<label class="compact-control"><span>阅读状态</span><select data-reading-state data-paper-id="${escapeHtml(record.arxiv_id)}">${selectOptions("未设置", READING_STATES, state, READING_STATE_LABELS)}</select></label>`;
}

function renderList() {
  document.title = "论文学习库 · Paper Notes";
  setFiltersVisible(true);
  syncFilterControls();
  renderSavedViews();
  const filtered = records.filter((record) => recordMatchesFilters(record, filtersState, studyStore));
  resultSummary.innerHTML = `显示 <strong>${filtered.length}</strong> / ${records.length} 篇论文`;

  if (!filtered.length) {
    reader.innerHTML = `<div class="empty-state"><h2>没有匹配的论文</h2><p>试试清除筛选条件，或创建一个新的自定义标签。</p></div>`;
    return;
  }

  reader.innerHTML = `<div class="paper-grid">${filtered.map((record) => {
    const customTags = studyStore.getPaper(record.arxiv_id).tags ?? [];
    return `<article class="paper-card">
      <div class="card-topline"><span class="arxiv-id">arXiv:${escapeHtml(record.arxiv_id)}</span><span>${escapeHtml(record.primary_category)}</span></div>
      <h2 class="card-title"><a href="?paper=${encodeURIComponent(record.arxiv_id)}" data-paper-id="${escapeHtml(record.arxiv_id)}">${escapeHtml(record.title)}</a></h2>
      <p class="authors">${escapeHtml(record.authors.join(" · "))}</p>
      <ul class="tag-list">${record.tags.slice(0, 3).map((tag) => `<li class="tag">#${escapeHtml(tag)}</li>`).join("")}${customTags.map((tag) => `<li class="tag tag-personal">${escapeHtml(tag)}</li>`).join("")}</ul>
      <div class="card-footer">${readingStateControl(record)}<a class="card-link" href="?paper=${encodeURIComponent(record.arxiv_id)}" data-paper-id="${escapeHtml(record.arxiv_id)}">阅读学习卡片 <span aria-hidden="true">→</span></a></div>
    </article>`;
  }).join("")}</div>`;
}

function customTagList(paperId) {
  const tags = studyStore.getPaper(paperId).tags ?? [];
  if (!tags.length) return `<p class="empty-inline">还没有自定义标签。</p>`;
  return `<ul class="tag-list personal-tag-list">${tags.map((tag) => `<li class="tag tag-personal">${escapeHtml(tag)} <button type="button" class="tag-remove" data-action="remove-tag" data-paper-id="${escapeHtml(paperId)}" data-tag="${escapeHtml(tag)}" aria-label="移除标签 ${escapeHtml(tag)}">×</button></li>`).join("")}</ul>`;
}

function reviewControl(paperId, target, label) {
  const review = studyStore.getPaper(paperId).reviews?.[target];
  const status = review?.status ?? "unreviewed";
  return `<div class="review-control"><label><span>${escapeHtml(label)}审核</span><select data-review-target="${escapeHtml(target)}" data-paper-id="${escapeHtml(paperId)}">${selectOptions("选择审核状态", REVIEW_STATUSES, status, REVIEW_STATUS_LABELS)}</select></label><p>${review ? `更新于 ${formatDateTime(review.updated_at)}` : "未记录审核结论"}</p></div>`;
}

function notesPanel(paperId) {
  const notes = studyStore.getPaper(paperId).notes ?? [];
  const editing = notes.find((note) => note.id === editingNoteId);
  return `<section class="study-panel notes-panel" aria-labelledby="notes-heading">
    <div><p class="section-label">本地学习笔记</p><h3 id="notes-heading">笔记</h3><p class="local-note">只保存在当前浏览器，清除浏览器数据后无法恢复。</p></div>
    <form data-form="note" data-paper-id="${escapeHtml(paperId)}" class="note-form">
      <input type="hidden" name="note-id" value="${escapeHtml(editing?.id ?? "")}">
      <label for="note-text">${editing ? "编辑笔记" : "添加笔记"}</label>
      <textarea id="note-text" name="note-text" rows="4" maxlength="12000" required placeholder="记录问题、结论或下次要读的章节…">${escapeHtml(editing?.text ?? "")}</textarea>
      <div class="form-actions"><button type="submit">${editing ? "保存修改" : "添加笔记"}</button>${editing ? `<button type="button" class="button-secondary" data-action="cancel-note">取消</button>` : ""}</div>
    </form>
    <ol class="notes-list">${notes.length ? notes.map((note) => `<li><div class="note-meta"><span>创建于 ${formatDateTime(note.created_at)}${note.updated_at !== note.created_at ? ` · 更新于 ${formatDateTime(note.updated_at)}` : ""}</span><span><button type="button" class="text-button" data-action="edit-note" data-note-id="${escapeHtml(note.id)}">编辑</button><button type="button" class="text-button danger-button" data-action="delete-note" data-paper-id="${escapeHtml(paperId)}" data-note-id="${escapeHtml(note.id)}">删除</button></span></div><p>${safeMultilineHtml(note.text)}</p></li>`).join("") : "<li class=\"empty-inline\">还没有笔记。添加第一条，帮助下次继续学习。</li>"}</ol>
  </section>`;
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
      <div class="detail-study-controls">${readingStateControl(record)}<p class="local-note">学习进度、标签、笔记和审核结论仅保存在当前浏览器。</p></div>
    </header>
    <section class="study-panel tag-panel" aria-labelledby="tags-heading">
      <div><p class="section-label">本地学习组织</p><h3 id="tags-heading">自定义标签</h3><p class="local-note">与 arXiv 分类和来源主题分开保存，不会改写源数据。</p></div>
      <div>${customTagList(record.arxiv_id)}<form data-form="custom-tag" data-paper-id="${escapeHtml(record.arxiv_id)}" class="inline-form"><label class="sr-only" for="custom-tag-input">新自定义标签</label><input id="custom-tag-input" name="custom-tag" maxlength="48" required placeholder="例如：组会分享"><button type="submit">添加标签</button></form></div>
    </section>
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
        ${reviewControl(record.arxiv_id, "translation", "中文摘要")}
        <h4>学习亮点</h4>
        <ol class="highlights">${ai.learning_highlights_zh.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("")}</ol>
        ${reviewControl(record.arxiv_id, "highlights", "学习亮点")}
        <div class="disclosure">
          <p><strong>生成时间：</strong>${formatDate(ai.generated_at)}</p>
          <p><strong>模型来源：</strong>${PUBLIC_AI_MODEL}</p>
          <p><strong>数据集来源：</strong>${DATASET_SOURCE}</p>
          <p>说明：历史数据不能恢复精确模型 slug，故不做推测；以上中文摘要和亮点均为 AI 生成内容。</p>
        </div>
      </section>
    </div>
    ${notesPanel(record.arxiv_id)}
  </article>`;

  document.querySelector("#back-to-list").addEventListener("click", () => {
    editingNoteId = "";
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

function showLoadError() {
  setFiltersVisible(false);
  reader.setAttribute("aria-busy", "false");
  reader.innerHTML = `<div class="load-error"><h2>数据未能加载</h2><p>请通过静态服务器打开此页面，例如运行 <code>npm run preview</code>，而不是直接双击 HTML 文件。</p></div>`;
}

function updateFilters() {
  filtersState = {
    query: searchInput.value,
    category: categoryFilter.value,
    topic: topicFilter.value,
    customTag: customTagFilter.value,
    readingState: readingStateFilter.value,
  };
  selectedViewId = "";
  renderList();
}

function applySavedView(viewId) {
  const view = studyStore.data.saved_views.find((item) => item.id === viewId);
  if (!view) return;
  filtersState = { ...EMPTY_FILTERS, ...view.filters };
  selectedViewId = view.id;
  renderList();
}

function refreshCurrentRoute() {
  renderRoute();
}

searchInput.addEventListener("input", updateFilters);
categoryFilter.addEventListener("change", updateFilters);
topicFilter.addEventListener("change", updateFilters);
customTagFilter.addEventListener("change", updateFilters);
readingStateFilter.addEventListener("change", updateFilters);
savedViewSelect.addEventListener("change", () => applySavedView(savedViewSelect.value));
document.querySelector("#save-saved-view").addEventListener("click", () => {
  if (studyStore.saveView(savedViewName.value, filtersState)) {
    savedViewName.value = "";
    selectedViewId = studyStore.data.saved_views.at(-1).id;
    renderList();
  }
});
document.querySelector("#rename-saved-view").addEventListener("click", () => {
  if (studyStore.renameView(selectedViewId, savedViewName.value)) {
    savedViewName.value = "";
    renderList();
  }
});
document.querySelector("#delete-saved-view").addEventListener("click", () => {
  if (selectedViewId && window.confirm("删除此保存的筛选？")) {
    studyStore.deleteView(selectedViewId);
    selectedViewId = "";
    renderList();
  }
});
reader.addEventListener("click", (event) => {
  const paperLink = event.target.closest("a[data-paper-id]");
  if (paperLink) {
    event.preventDefault();
    editingNoteId = "";
    history.pushState({}, "", `${window.location.pathname}?paper=${encodeURIComponent(paperLink.dataset.paperId)}`);
    renderRoute();
    document.querySelector("#main-content").focus();
    return;
  }

  const action = event.target.closest("button[data-action]");
  if (!action) return;
  if (action.dataset.action === "remove-tag") {
    studyStore.removeTag(action.dataset.paperId, action.dataset.tag);
  } else if (action.dataset.action === "edit-note") {
    editingNoteId = action.dataset.noteId;
  } else if (action.dataset.action === "cancel-note") {
    editingNoteId = "";
  } else if (action.dataset.action === "delete-note" && window.confirm("删除这条笔记？")) {
    studyStore.deleteNote(action.dataset.paperId, action.dataset.noteId);
    editingNoteId = "";
  } else {
    return;
  }
  refreshCurrentRoute();
});
reader.addEventListener("change", (event) => {
  const control = event.target;
  if (control.matches("[data-reading-state]")) {
    studyStore.setReadingState(control.dataset.paperId, control.value);
    refreshCurrentRoute();
  }
  if (control.matches("[data-review-target]")) {
    studyStore.setReviewStatus(control.dataset.paperId, control.dataset.reviewTarget, control.value);
    refreshCurrentRoute();
  }
});
reader.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.matches("form[data-form]")) return;
  event.preventDefault();
  const formData = new FormData(form);
  const paperId = form.dataset.paperId;
  if (form.dataset.form === "custom-tag") studyStore.addTag(paperId, formData.get("custom-tag"));
  if (form.dataset.form === "note") {
    const noteId = formData.get("note-id");
    if (noteId) studyStore.updateNote(paperId, noteId, formData.get("note-text"));
    else studyStore.addNote(paperId, formData.get("note-text"));
    editingNoteId = "";
  }
  refreshCurrentRoute();
});
window.addEventListener("popstate", () => {
  editingNoteId = "";
  renderRoute();
});

async function start() {
  try {
    studyStore.load();
    if (!studyStore.storageAvailable) {
      storageNotice.hidden = false;
      storageNotice.textContent = "此浏览器当前不允许 localStorage，学习数据不会在刷新后保留。原始论文数据未受影响。";
    } else if (studyStore.recovered) {
      storageNotice.hidden = false;
      storageNotice.textContent = "检测到无效或旧版本地学习数据，已安全回退为空状态。原始论文数据未受影响。";
    }
    const response = await fetch("./data/paper_learning_mvp_sample.json");
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    const data = await response.json();
    records = data.records;
    populateSourceFilters();
    renderRoute();
  } catch (error) {
    console.error(error);
    showLoadError();
  } finally {
    reader.setAttribute("aria-busy", "false");
  }
}

start();
