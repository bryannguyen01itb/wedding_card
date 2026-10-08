import assert from "node:assert/strict";
import { getListPage, normalizeSearchText } from "../admin/list-utils.js";

const items = Array.from({ length: 1000 }, (_, i) => ({
    id: `wedding-${i + 1}`,
    name: `Khách ${i + 1}`,
    orderCode: `WC${String(i + 1).padStart(8, "0")}`,
    paid: i % 2 === 0
}));
items[998].name = "Đặng Ánh & Trần Hảo";
const search = item => `${item.name} ${item.id} ${item.orderCode}`;
const initial = { query: "", filter: "all", page: 1, pageSize: 10 };
assert.equal(normalizeSearchText(" ĐẶNG ÁNH "), "dang anh");

// All 1,000 items are reachable, once each; pagination does not trim the cache.
const reached = [];
for (let page = 1; page <= 100; page++) {
    const result = getListPage(items, { ...initial, page }, search);
    assert.equal(result.items.length, 10);
    assert.equal(result.pageCount, 100);
    reached.push(...result.items.map(item => item.id));
}
assert.equal(new Set(reached).size, 1000);
assert.equal(items.length, 1000);
assert.equal(getListPage(items, initial, search).matchingIds.length, 1000);
assert.equal(reached.at(-1), "wedding-1000");

// Search reaches records beyond the previous 200-document cap, with/without accents.
for (const query of ["dang hao", "ĐẶNG ÁNH", "wc00000999", "wedding-999"]) {
    const result = getListPage(items, { ...initial, query, page: 100 }, search);
    assert.equal(result.matching, 1);
    assert.equal(result.page, 1);
    assert.equal(result.items[0].id, "wedding-999");
}
const paid = (item, filter) => filter === "all" || item.paid;
const filtered = getListPage(items, { ...initial, filter: "paid", pageSize: 20 }, search, paid);
assert.equal(filtered.matching, 500);
assert.equal(filtered.matchingIds.length, 500);
assert.equal(filtered.pageCount, 25);
assert(filtered.items.every(item => item.paid));
assert.equal(getListPage(items, { ...initial, filter: "paid", query: "wedding-1000" }, search, paid).matching, 0);
assert.equal(getListPage(items, { ...initial, pageSize: 50 }, search).pageCount, 20);

// Deleting the final page moves back to the last available page.
const shortened = getListPage(items.slice(0, 990), { ...initial, page: 100 }, search);
assert.equal(shortened.page, 99);
assert.equal(shortened.start, 981);
assert.equal(shortened.end, 990);
const empty = getListPage([], initial, search);
assert.equal(empty.start, 0);
assert.equal(empty.end, 0);
assert.equal(empty.page, 1);

// Music search/filter applies to all cached songs, not just the visible page.
const songs = Array.from({ length: 31 }, (_, i) => ({ id: `song-${i}`, title: `Bài ${i}`, active: i % 2 === 0 }));
songs[30].title = "Đám cưới trên đường quê";
const music = getListPage(songs, { ...initial, query: "dam cuoi", filter: "active" }, item => item.title, item => item.active !== false);
assert.equal(music.matching, 1);
assert.equal(music.items[0].id, "song-30");
console.log("PASS: 1,000 records, accent-insensitive names/codes/IDs, filters, page sizes, deleted last page and music search.");
