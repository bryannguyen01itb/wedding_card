export function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .trim();
}

/** Search/filter the whole cache before slicing a page; never mutate its items. */
export function getListPage(items, state, searchText, matchesFilter = () => true) {
    const tokens = normalizeSearchText(state.query).split(/\s+/).filter(Boolean);
    const matches = items.filter(item => {
        if (!matchesFilter(item, state.filter)) return false;
        const text = normalizeSearchText(searchText(item));
        return tokens.every(token => text.includes(token));
    });
    const pageSize = [10, 20, 50].includes(Number(state.pageSize)) ? Number(state.pageSize) : 10;
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.trunc(Number(state.page)) || 1));
    const offset = (page - 1) * pageSize;
    return {
        items: matches.slice(offset, offset + pageSize),
        matchingIds: matches.map(item => item.id),
        total: items.length,
        matching: matches.length,
        page,
        pageCount,
        start: matches.length ? offset + 1 : 0,
        end: Math.min(offset + pageSize, matches.length)
    };
}
