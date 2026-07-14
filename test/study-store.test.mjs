import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safeMultilineHtml } from "../site/js/safe-html.js";
import { listCustomTags, recordMatchesFilters } from "../site/js/study-filters.js";
import { STUDY_STORAGE_KEY, StudyStore } from "../site/js/study-store.js";

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

function createStore(storage = new MemoryStorage()) {
  let number = 0;
  const store = new StudyStore({
    storage,
    now: () => "2026-07-14T12:00:00.000Z",
    idMaker: () => `id-${++number}`,
  });
  store.load();
  return store;
}

const sampleRecord = {
  arxiv_id: "2210.03629",
  title: "ReAct: Synergizing Reasoning and Acting in Language Models",
  authors: ["Shunyu Yao"],
  categories: ["cs.AI", "cs.CL"],
  tags: ["ai-agent", "tool-use"],
};

test("reading state, custom tags, notes, and reviews support CRUD", () => {
  const store = createStore();
  assert.equal(store.setReadingState(sampleRecord.arxiv_id, "queued"), true);
  assert.equal(store.getPaper(sampleRecord.arxiv_id).reading_state, "queued");
  assert.equal(store.setReadingState(sampleRecord.arxiv_id, "not-a-state"), true);
  assert.equal(store.getPaper(sampleRecord.arxiv_id).reading_state, undefined);

  store.addTag(sampleRecord.arxiv_id, "  组会  ");
  store.addTag(sampleRecord.arxiv_id, "组会");
  assert.deepEqual(store.getPaper(sampleRecord.arxiv_id).tags, ["组会"]);
  store.removeTag(sampleRecord.arxiv_id, "组会");
  assert.equal(store.getPaper(sampleRecord.arxiv_id).tags, undefined);

  store.addNote(sampleRecord.arxiv_id, "先读实验部分");
  const note = store.getPaper(sampleRecord.arxiv_id).notes[0];
  assert.deepEqual(note, { id: "id-1", text: "先读实验部分", created_at: "2026-07-14T12:00:00.000Z", updated_at: "2026-07-14T12:00:00.000Z" });
  store.updateNote(sampleRecord.arxiv_id, note.id, "先读实验和附录");
  assert.equal(store.getPaper(sampleRecord.arxiv_id).notes[0].text, "先读实验和附录");
  store.deleteNote(sampleRecord.arxiv_id, note.id);
  assert.equal(store.getPaper(sampleRecord.arxiv_id).notes, undefined);

  store.setReviewStatus(sampleRecord.arxiv_id, "translation", "accepted");
  assert.deepEqual(store.getPaper(sampleRecord.arxiv_id).reviews.translation, { status: "accepted", updated_at: "2026-07-14T12:00:00.000Z" });
  store.setReviewStatus(sampleRecord.arxiv_id, "translation", "unreviewed");
  assert.equal(store.getPaper(sampleRecord.arxiv_id).reviews, undefined);
});

test("compound filters and saved views persist across a fresh store", () => {
  const storage = new MemoryStorage();
  const store = createStore(storage);
  store.setReadingState(sampleRecord.arxiv_id, "reading");
  store.addTag(sampleRecord.arxiv_id, "精读");
  const filters = { query: "react", category: "cs.AI", topic: "tool-use", customTag: "精读", readingState: "reading" };
  assert.equal(recordMatchesFilters(sampleRecord, filters, store), true);
  assert.deepEqual(listCustomTags(store), ["精读"]);
  store.saveView("本周精读", filters);
  store.renameView("id-1", "本周精读（已更新）");

  const replay = createStore(storage);
  assert.equal(replay.getPaper(sampleRecord.arxiv_id).reading_state, "reading");
  assert.deepEqual(replay.data.saved_views[0].filters, filters);
  assert.equal(replay.data.saved_views[0].name, "本周精读（已更新）");
  assert.equal(replay.deleteView("id-1"), true);
  assert.equal(replay.data.saved_views.length, 0);
});

test("damaged or old storage falls back without blocking baseline records", async () => {
  const broken = createStore(new MemoryStorage({ [STUDY_STORAGE_KEY]: "{not-json" }));
  assert.equal(broken.recovered, true);
  assert.deepEqual(broken.data.papers, {});

  const old = createStore(new MemoryStorage({ [STUDY_STORAGE_KEY]: JSON.stringify({ version: 0, papers: {}, saved_views: [] }) }));
  assert.equal(old.recovered, true);
  assert.deepEqual(old.data.saved_views, []);

  const data = JSON.parse(await readFile(new URL("../site/data/paper_learning_mvp_sample.json", import.meta.url), "utf8"));
  assert.equal(data.records.length, 8);
  assert.equal(data.records.every((record) => !record.copyright.full_text_stored && record.ai_generated.generated_at && record.source.url), true);
});

test("storage access failures leave the reader usable without claiming persistence", () => {
  const deniedStorage = {
    getItem() { throw new Error("storage denied"); },
    setItem() { throw new Error("storage denied"); },
  };
  const store = createStore(deniedStorage);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.setReadingState(sampleRecord.arxiv_id, "read"), false);
  assert.equal(store.getPaper(sampleRecord.arxiv_id).reading_state, "read");
});

test("note text is escaped before multiline display", () => {
  const rendered = safeMultilineHtml('<img src=x onerror="alert(1)">\nkeep learning');
  assert.equal(rendered.includes("<img"), false);
  assert.match(rendered, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;<br>keep learning/);
});
