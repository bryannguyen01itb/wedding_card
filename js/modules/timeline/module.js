import { renderTimeline } from "./render.js";

/** Skins khi tổ chức riêng (nhà trai / nhà gái). */
export const TIMELINE_SKINS_SEPARATE = [
    "concept-1",
    "concept-2",
    "concept-3",
    "concept-4",
    "concept-5",
    "concept-6",
    "concept-7"
];

/**
 * Skins khi tổ chức chung (1 địa điểm).
 * joint-1 = trục dọc icon · chấm · giờ + tên
 * joint-2 = đường sóng ngang
 * joint-3 = trục giữa xen kẽ trái/phải + icon
 */
export const TIMELINE_SKINS_JOINT = [
    "joint-1",
    "joint-2",
    "joint-3"
];

/** Timeline / ceremony schedule module. */
export const timelineModule = {
    id: "timeline",
    label: "Lịch trình",
    selector: ".timeline",
    builderField: "blockTimeline",
    defaultSkin: "concept-1",
    order: 50,
    buildable: true,
    cssFile: "css/blocks/timeline/skins.css",
    skins: TIMELINE_SKINS_SEPARATE,
    /**
     * usesCeremonyImage: concept 1–3 hiện ảnh ceremony; 4–7 / joint không.
     */
    skinOptions: {
        default: { usesCeremonyImage: true },
        "concept-1": { usesCeremonyImage: true },
        "concept-2": { usesCeremonyImage: true },
        "concept-3": { usesCeremonyImage: true },
        "concept-4": { usesCeremonyImage: false },
        "concept-5": { usesCeremonyImage: false },
        "concept-6": { usesCeremonyImage: false },
        "concept-7": { usesCeremonyImage: false },
        "joint-1": { usesCeremonyImage: false },
        "joint-2": { usesCeremonyImage: false },
        "joint-3": { usesCeremonyImage: false }
    },
    /**
     * Danh sách skin theo chế độ tổ chức (builder + resolve).
     * @param {{ ceremonyMode?: string }} context
     */
    getSkins(context = {}) {
        const mode = context.ceremonyMode === "joint" ? "joint" : "separate";
        return mode === "joint" ? [...TIMELINE_SKINS_JOINT] : [...TIMELINE_SKINS_SEPARATE];
    },
    render: renderTimeline
};
