export function parseWeddingDate(dateValue) {
    if (dateValue?.toDate) {
        return parseWeddingDate(dateValue.toDate());
    }

    if (dateValue instanceof Date) {
        return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
    }

    const value = String(dateValue || "").trim();
    const parts = value.split(/[./-]/).map(part => Number(part));

    if (parts.length === 3 && parts.every(Number.isFinite)) {
        const [first, second, third] = parts;
        const isYearFirst = String(value.split(/[./-]/)[0]).length === 4;
        const year = isYearFirst ? first : third;
        const month = isYearFirst ? second : second;
        const day = isYearFirst ? third : first;

        return new Date(year, month - 1, day);
    }

    return new Date(value);
}

export function formatDate(dateString) {
    const date = parseWeddingDate(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return day + "." + month + "." + year;
}

export function formatEventTime(weddingDate, time) {
    return `${time} • ${formatDate(weddingDate)}`;
}
