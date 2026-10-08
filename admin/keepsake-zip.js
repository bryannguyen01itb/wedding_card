// Stored ZIP: keeps each self-contained HTML intact, without a CDN dependency.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    return value >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
}
function header(size, fields) {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    for (const [offset, width, value] of fields) {
        if (width === 2) view.setUint16(offset, value, true);
        else view.setUint32(offset, value, true);
    }
    return bytes;
}
export function createKeepsakeZip() {
    const parts = [], directory = [];
    let offset = 0, directorySize = 0, count = 0;
    return {
        add(filename, text) {
            const name = encoder.encode(filename);
            const bytes = encoder.encode(text);
            if (count >= 65535 || name.length > 65535 || offset + bytes.length + name.length + 30 > 0xffffffff) {
                throw new Error("Gói xuất quá lớn. Hãy chọn ít thiệp hơn mỗi lần.");
            }
            const crc = crc32(bytes);
            const local = header(30, [[0,4,0x04034b50],[4,2,20],[6,2,0x800],[12,2,33],[14,4,crc],[18,4,bytes.length],[22,4,bytes.length],[26,2,name.length]]);
            const central = header(46, [[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[14,2,33],[16,4,crc],[20,4,bytes.length],[24,4,bytes.length],[28,2,name.length],[42,4,offset]]);
            parts.push(local, name, bytes);
            directory.push(central, name);
            offset += local.length + name.length + bytes.length;
            directorySize += central.length + name.length;
            count++;
        },
        blob() {
            if (offset + directorySize + 22 > 0xffffffff) throw new Error("Gói xuất quá lớn. Hãy chọn ít thiệp hơn mỗi lần.");
            const end = header(22, [[0,4,0x06054b50],[8,2,count],[10,2,count],[12,4,directorySize],[16,4,offset]]);
            return new Blob([...parts, ...directory, end], { type: "application/zip" });
        }
    };
}
export function downloadKeepsakeZip(zip) {
    const url = URL.createObjectURL(zip.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "thiep-ky-niem.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
