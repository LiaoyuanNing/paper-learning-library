export const EMPTY_FILTERS = Object.freeze({ query: "", category: "", topic: "", customTag: "", readingState: "" });

export function recordKey(record) {
  return record.source?.kind === "repository_preprint" ? record.id : record.arxiv_id;
}

export function recordMatchesFilters(record, filters, studyStore) {
  const searchSpace = `${record.title} ${record.authors.join(" ")}`.toLocaleLowerCase();
  const query = filters.query.trim().toLocaleLowerCase();
  const paper = studyStore.getPaper(recordKey(record));
  return (!query || searchSpace.includes(query))
    && (!filters.category || record.categories.includes(filters.category))
    && (!filters.topic || record.tags.includes(filters.topic))
    && (!filters.customTag || (paper.tags ?? []).includes(filters.customTag))
    && (!filters.readingState || paper.reading_state === filters.readingState);
}

export function listCustomTags(studyStore) {
  return [...new Set(Object.values(studyStore.data.papers).flatMap((paper) => paper.tags ?? []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
