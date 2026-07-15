import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function getArgValue(name) {
    const prefix = `${name}=`;
    const arg = process.argv.find(item => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : "";
}

async function importConfig(configPath) {
    const absolutePath = path.resolve(configPath);
    const source = await fs.readFile(absolutePath, "utf8");
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    const module = await import(moduleUrl);

    if (!module.wedding) {
        throw new Error(`Không tìm thấy export wedding trong ${absolutePath}`);
    }

    return module.wedding;
}

function removeUndefined(value) {
    if (Array.isArray(value)) {
        return value.map(removeUndefined);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .map(([key, item]) => [key, removeUndefined(item)])
        );
    }

    return value;
}

async function main() {
    const configPath = getArgValue("--config") || "js/config.js";
    const serviceAccountPath = getArgValue("--service-account")
        || process.env.GOOGLE_APPLICATION_CREDENTIALS
        || "scripts/serviceAccountKey.json";
    const merge = process.argv.includes("--merge");

    const wedding = removeUndefined(await importConfig(configPath));

    if (!wedding.weddingId) {
        throw new Error("Config thiếu weddingId. Hãy thêm weddingId trước khi upload.");
    }

    // Catalog local không thuộc document thiệp (tránh phình doc / trùng collection musicLibrary)
    delete wedding.musicLibrary;

    const serviceAccount = JSON.parse(await fs.readFile(path.resolve(serviceAccountPath), "utf8"));
    const admin = require("firebase-admin");

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    const db = admin.firestore();
    const docRef = db.collection("weddings").doc(wedding.weddingId);

    const payload = merge
        ? { ...wedding, musicLibrary: admin.firestore.FieldValue.delete() }
        : wedding;

    await docRef.set(payload, { merge });

    console.log(`Đã upload config lên Firestore: weddings/${wedding.weddingId}`);
    console.log(merge ? "Chế độ: merge" : "Chế độ: ghi đè document config");
}

main().catch(error => {
    console.error("Upload config thất bại:");
    console.error(error);
    process.exit(1);
});
