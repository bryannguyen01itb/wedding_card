/**
 * Unit tests nhẹ cho js/utils/security.js (không cần browser Firebase).
 * Usage: node scripts/test-security.mjs
 */
import {
    sanitizePaymentForBuilderSave,
    canOpenBuilderEdit,
    assertWishPayload,
    assertUploadBlob,
    normalizeEditToken,
    normalizeOrderCode,
    extractOrderCodeFromText
} from "../js/utils/security.js";

let failed = 0;

function assert(cond, msg) {
    if (!cond) {
        failed += 1;
        console.error("FAIL:", msg);
    } else {
        console.log("ok:", msg);
    }
}

// sanitize: draft cannot escalate
{
    const out = sanitizePaymentForBuilderSave(
        { status: "pending", unlocked: false, accessToken: "a".repeat(32) },
        { status: "paid", unlocked: true, plan: "multi", amount: 1 }
    );
    assert(out.unlocked === false && out.status === "pending", "draft cannot unlock");
    assert(out.accessToken === "a".repeat(32), "keep existing accessToken");
}

// sanitize: paid keeps unlocked
{
    const out = sanitizePaymentForBuilderSave(
        { status: "paid", unlocked: true, accessToken: "b".repeat(32), plan: "single", amount: 99 },
        { status: "pending", unlocked: false, plan: "multi" }
    );
    assert(out.unlocked === true && out.status === "paid", "paid stays paid");
    assert(out.plan === "single", "paid plan locked to previous");
}

// edit token
assert(normalizeEditToken("ABCDEF") === "", "short edit token invalid");
assert(normalizeEditToken("a".repeat(32)) === "a".repeat(32), "edit token 32 hex ok");
assert(canOpenBuilderEdit({ builder: {} }, "") === true, "legacy no token open");
assert(canOpenBuilderEdit({ builder: { editToken: "c".repeat(32) } }, "c".repeat(32)) === true, "matching e ok");
assert(canOpenBuilderEdit({ builder: { editToken: "c".repeat(32) } }, "d".repeat(32)) === false, "wrong e denied");

// wish
{
    const bad = assertWishPayload({ name: "", message: "hi" });
    assert(!bad.ok, "empty name wish rejected");
    const good = assertWishPayload({ name: "A", message: "Chuc mung", side: "groom", attendance: "yes" });
    assert(good.ok && good.data.name === "A", "valid wish ok");
}

// upload blob
assert(!assertUploadBlob(null).ok, "null blob rejected");
assert(assertUploadBlob({ size: 100, type: "image/jpeg" }).ok, "jpeg blob ok");
assert(!assertUploadBlob({ size: 100, type: "application/pdf" }).ok, "pdf rejected");

// order codes (SePay)
assert(normalizeOrderCode("wc7k3m9p2x") === "WC7K3M9P2X", "order code normalize");
assert(normalizeOrderCode("bad") === "", "bad order code rejected");
assert(
    extractOrderCodeFromText("CK WC7K3M9P2X nhe") === "WC7K3M9P2X",
    "extract order from transfer content"
);
assert(
    extractOrderCodeFromText("SEVN63DC8E5C", "WCABCDEF23 chuyen tien") === "WCABCDEF23",
    "extract prefers WC pattern in content"
);

// upsertOrderCodeMap shape (no firebase) — invalid inputs
{
    const r1 = await (async () => {
        const { upsertOrderCodeMap } = await import("../js/utils/security.js");
        return upsertOrderCodeMap(null, "WCABCDEF23", { weddingId: "x" });
    })();
    assert(r1 && r1.ok === false, "upsertOrderCodeMap no db returns ok false");
}

if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log("\nAll security unit tests passed.");
