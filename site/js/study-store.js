export const STUDY_STORAGE_KEY = "paper-learning-library.study.v1";
export const STUDY_SCHEMA_VERSION = 1;

export const READING_STATES = ["queued", "reading", "read", "archived"];
export const REVIEW_STATUSES = ["unreviewed", "accepted", "needs_edit", "rejected"];
const REVIEW_TARGETS = ["translation", "highlights"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeTag(value) {
  return normalizeText(value, 48).replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeFilters(value) {
  const filters = isPlainObject(value) ? value : {};
  return {
    query: normalizeText(filters.query, 160),
    category: normalizeText(filters.category, 80),
    topic: normalizeText(filters.topic, 80),
    customTag: normalizeTag(filters.customTag),
    readingState: READING_STATES.includes(filters.readingState) ? filters.readingState : "",
  };
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((note) => {
    if (!isPlainObject(note)) return [];
    const id = normalizeText(note.id, 120);
    const text = normalizeText(note.text, 12000);
    const createdAt = normalizeText(note.created_at, 80);
    const updatedAt = normalizeText(note.updated_at, 80);
    if (!id || !text || !createdAt || !updatedAt) return [];
    return [{ id, text, created_at: createdAt, updated_at: updatedAt }];
  });
}

function normalizeReviews(value) {
  const reviews = isPlainObject(value) ? value : {};
  return Object.fromEntries(REVIEW_TARGETS.flatMap((target) => {
    const review = reviews[target];
    if (!isPlainObject(review) || !REVIEW_STATUSES.includes(review.status) || review.status === "unreviewed") return [];
    const updatedAt = normalizeText(review.updated_at, 80);
    return updatedAt ? [[target, { status: review.status, updated_at: updatedAt }]] : [];
  }));
}

function normalizePaper(value) {
  const paper = isPlainObject(value) ? value : {};
  const readingState = READING_STATES.includes(paper.reading_state) ? paper.reading_state : "";
  const tags = [...new Set((Array.isArray(paper.tags) ? paper.tags : []).map(normalizeTag).filter(Boolean))].slice(0, 40);
  const notes = normalizeNotes(paper.notes);
  const reviews = normalizeReviews(paper.reviews);
  return {
    ...(readingState ? { reading_state: readingState } : {}),
    ...(tags.length ? { tags } : {}),
    ...(notes.length ? { notes } : {}),
    ...(Object.keys(reviews).length ? { reviews } : {}),
  };
}

export function createEmptyStudyData() {
  return { version: STUDY_SCHEMA_VERSION, papers: {}, saved_views: [] };
}

export function normalizeStudyData(value) {
  if (!isPlainObject(value) || value.version !== STUDY_SCHEMA_VERSION || !isPlainObject(value.papers) || !Array.isArray(value.saved_views)) {
    return { data: createEmptyStudyData(), recovered: true };
  }

  const papers = Object.fromEntries(Object.entries(value.papers).flatMap(([paperId, paper]) => {
    const id = normalizeText(paperId, 100);
    if (!id) return [];
    const normalized = normalizePaper(paper);
    return Object.keys(normalized).length ? [[id, normalized]] : [];
  }));

  const savedViews = value.saved_views.flatMap((view) => {
    if (!isPlainObject(view)) return [];
    const id = normalizeText(view.id, 120);
    const name = normalizeText(view.name, 80);
    const createdAt = normalizeText(view.created_at, 80);
    const updatedAt = normalizeText(view.updated_at, 80);
    if (!id || !name || !createdAt || !updatedAt) return [];
    return [{ id, name, filters: normalizeFilters(view.filters), created_at: createdAt, updated_at: updatedAt }];
  }).slice(0, 30);

  return {
    data: { version: STUDY_SCHEMA_VERSION, papers, saved_views: savedViews },
    recovered: false,
  };
}

function defaultNow() {
  return new Date().toISOString();
}

function defaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `study-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class StudyStore {
  constructor({ storage, now = defaultNow, idMaker = defaultId } = {}) {
    this.storage = storage;
    this.storageAvailable = Boolean(storage && typeof storage.getItem === "function" && typeof storage.setItem === "function");
    this.now = now;
    this.idMaker = idMaker;
    this.data = createEmptyStudyData();
    this.recovered = false;
  }

  load() {
    if (!this.storageAvailable) {
      return this.data;
    }
    let raw = null;
    try {
      raw = this.storage.getItem(STUDY_STORAGE_KEY) ?? null;
    } catch {
      this.storageAvailable = false;
      return this.data;
    }
    if (!raw) return this.data;

    try {
      const normalized = normalizeStudyData(JSON.parse(raw));
      this.data = normalized.data;
      this.recovered = normalized.recovered;
    } catch {
      this.data = createEmptyStudyData();
      this.recovered = true;
    }
    return this.data;
  }

  persist() {
    if (!this.storageAvailable) return false;
    try {
      this.storage.setItem(STUDY_STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      this.storageAvailable = false;
      return false;
    }
  }

  getPaper(paperId) {
    return this.data.papers[paperId] ?? {};
  }

  updatePaper(paperId, updater) {
    const id = normalizeText(paperId, 100);
    if (!id) return false;
    const next = normalizePaper(updater({ ...this.getPaper(id) }));
    if (Object.keys(next).length) this.data.papers[id] = next;
    else delete this.data.papers[id];
    return this.persist();
  }

  setReadingState(paperId, readingState) {
    const state = READING_STATES.includes(readingState) ? readingState : "";
    return this.updatePaper(paperId, (paper) => ({ ...paper, reading_state: state }));
  }

  addTag(paperId, value) {
    const tag = normalizeTag(value);
    if (!tag) return false;
    return this.updatePaper(paperId, (paper) => ({ ...paper, tags: [...new Set([...(paper.tags ?? []), tag])] }));
  }

  removeTag(paperId, value) {
    const tag = normalizeTag(value);
    return this.updatePaper(paperId, (paper) => ({ ...paper, tags: (paper.tags ?? []).filter((item) => item !== tag) }));
  }

  addNote(paperId, value) {
    const text = normalizeText(value, 12000);
    if (!text) return false;
    const timestamp = this.now();
    return this.updatePaper(paperId, (paper) => ({
      ...paper,
      notes: [...(paper.notes ?? []), { id: this.idMaker(), text, created_at: timestamp, updated_at: timestamp }],
    }));
  }

  updateNote(paperId, noteId, value) {
    const text = normalizeText(value, 12000);
    const id = normalizeText(noteId, 120);
    if (!id || !text) return false;
    const timestamp = this.now();
    return this.updatePaper(paperId, (paper) => ({
      ...paper,
      notes: (paper.notes ?? []).map((note) => note.id === id ? { ...note, text, updated_at: timestamp } : note),
    }));
  }

  deleteNote(paperId, noteId) {
    const id = normalizeText(noteId, 120);
    return this.updatePaper(paperId, (paper) => ({ ...paper, notes: (paper.notes ?? []).filter((note) => note.id !== id) }));
  }

  setReviewStatus(paperId, target, status) {
    if (!REVIEW_TARGETS.includes(target) || !REVIEW_STATUSES.includes(status)) return false;
    return this.updatePaper(paperId, (paper) => {
      const reviews = { ...(paper.reviews ?? {}) };
      if (status === "unreviewed") delete reviews[target];
      else reviews[target] = { status, updated_at: this.now() };
      return { ...paper, reviews };
    });
  }

  saveView(name, filters) {
    const label = normalizeText(name, 80);
    if (!label || this.data.saved_views.length >= 30) return false;
    const timestamp = this.now();
    this.data.saved_views.push({ id: this.idMaker(), name: label, filters: normalizeFilters(filters), created_at: timestamp, updated_at: timestamp });
    return this.persist();
  }

  renameView(viewId, name) {
    const id = normalizeText(viewId, 120);
    const label = normalizeText(name, 80);
    if (!id || !label) return false;
    const view = this.data.saved_views.find((item) => item.id === id);
    if (!view) return false;
    view.name = label;
    view.updated_at = this.now();
    return this.persist();
  }

  deleteView(viewId) {
    const id = normalizeText(viewId, 120);
    const before = this.data.saved_views.length;
    this.data.saved_views = this.data.saved_views.filter((item) => item.id !== id);
    return before !== this.data.saved_views.length && this.persist();
  }
}
