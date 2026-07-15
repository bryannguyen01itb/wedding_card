/**
 * Cấu hình nội dung thiệp cưới (mẫu local + tham chiếu field Firebase).
 *
 * === Schema Firebase (weddings/{weddingId}) — field quan trọng ===
 *
 * 0) Định danh
 *    - weddingId (doc id) — nội bộ (Firebase path, Cloudinary folder, link sửa ?wedding=)
 *      * KHÔNG hiện cho khách trên builder UI
 *    - payment.orderCode — mã giao dịch / nội dung chuyển khoản (vd "WC7K3M9P2X")
 *      * Generate lúc Lưu Firebase; hiện popup chờ TT + admin danh sách thiệp
 *      * Khách chỉ cần mã này khi CK; admin đối chiếu mã ↔ thiệp
 *
 * 1) Poster location — 1 link thiệp, hiện cả 2 tỉnh
 *    - ceremony.bride.location  — tỉnh/TP nhà gái (vd: "Hà Nội")
 *    - ceremony.groom.location  — tỉnh/TP nhà trai (vd: "Hải Phòng")
 *    - Để trống → lấy cụm cuối ceremony.*.address, uppercase
 *    - Poster: "HÀ NỘI · HẢI PHÒNG" (cô dâu · chú rể); trùng tỉnh → 1 lần
 *    - (Đã bỏ wedding.location root và ?side=groom|bride)
 *
 * 2) Gói thiệp + khách mời
 *    - plan: "single" | "multi"
 *        single = 1 link chung (cover "Quý khách")
 *        multi  = link theo từng tên trong guests[]
 *    - guests: string[]  — chỉ dùng khi plan === "multi" (vd ["Anh A","Chị B"])
 *    - cover.guest: mặc định "Quý khách"; link ?g=<index> ghi đè = guests[index]
 *
 * 3) Thanh toán + link thiệp
 *    - payment.orderCode        — mã GD (nội dung CK), format WC + 8 ký tự dễ đọc
 *    - payment.accessToken      — hex 32 ký tự (random), link khách ?t=
 *    - payment.unlocked / payment.status — "paid" + unlocked:true mới mở thiệp public
 *    - payment.amount, payment.currency — snapshot lúc Lưu Firebase
 *    - payment.plan — "single" | "multi"
 *    Link 1 khách: /?t=<accessToken>
 *    Link multi:   /?t=<accessToken>&g=0
 *    Link sửa:     /builder/?wedding=<weddingId>&e=<builder.editToken>
 *                  (editToken ẩn với khách; chỉ có trên link sau khi Lưu)
 *
 * 4) Public: ưu tiên ?t=; ?wedding=<id> chỉ hữu ích khi đã paid
 *
 * 5) builder (chỉ builder / admin)
 *    - builder.editToken — hex 32, bảo vệ link sửa (?e=)
 *    - builder.groomNickname, builder.brideNickname
 *    - builder.mediaFingerprints — hash file tránh re-upload Cloudinary trùng
 *    - builder.cloudinaryPublicIds — list public_id để xóa ảnh khi admin xóa thiệp
 *    - builder.generatedBaseWeddingId
 *
 * 6) Collection phụ (bảo mật / tra cứu)
 *    - accessTokens/{accessToken} → { weddingId }
 *    - editAccess/{editToken} → { weddingId }
 *    - editSessions/{editToken} → bản nháp builder
 *    - paymentStatus/{weddingId} → { orderCode, unlocked, status, accessToken, … }
 *    - orderCodes/{orderCode} → { weddingId, amount, status }  — SePay webhook
 *    - sepayEvents/{txnId} → dedup webhook (chỉ server)
 *
 * 7) Vòng đời / dọn admin
 *    - createdAt, updatedAt — serverTimestamp
 *    - Subcollection: weddings/{id}/wishes
 *    - Xóa thiệp: dọn map token + (best-effort) Cloudinary public_ids
 *
 * === settings/payment (doc global admin) ===
 *    - amount, amountMulti, currency, contactUrl, qrImage, receiver
 *    - message — nhắc CK bằng MÃ GIAO DỊCH (orderCode), không dùng weddingId
 */
import { BRAND_PRIMARY } from "./brand.js";

export let wedding = {
    // --- Thông tin chung ---
    weddingId: "wedding-cp-4",
    date: "2026-09-12",
    music: "music/1_doi.mp3",

    /**
     * Thanh toán / mở khóa (Firebase: weddings/{id}.payment)
     * amount + plan: snapshot lúc Lưu Firebase (từ settings/payment theo gói).
     * orderCode: mã GD hiện cho khách (nội dung CK) — admin list hiển thị cùng thiệp.
     */
    payment: {
        status: "pending", // "pending" | "paid" | "locked"
        unlocked: false,
        /** "single" | "multi" — gói thiệp lúc snapshot giá */
        plan: "single",
        /** Số tiền snapshot (99k / 129k hoặc giá admin cấu hình) */
        amount: 99000,
        currency: "VND",
        /**
         * Mã giao dịch / nội dung chuyển khoản (vd WC7K3M9P2X).
         * Generate lúc Lưu builder; KHÔNG dùng weddingId cho CK.
         */
        orderCode: "",
        /** Random 32 hex — link khách ?t= (không hiện cho khách dạng id) */
        accessToken: "",
        /**
         * Nguồn mở khóa: "sepay" (webhook) | "manual" (admin) | ""
         * txnId / referenceCode / paidAt do webhook ghi.
         */
        provider: "",
        txnId: ""
    },

    // --- Catalog nhạc local (folder music/) — chỉ dùng code/builder select ---
    // KHÔNG ghi field này lên weddings/{id}. Thư viện remote: collection Firestore musicLibrary.
    // Mỗi thiệp chỉ lưu field music (1 URL bài đang chọn).
    musicLibrary: [
        { title: "Một đời", url: "music/1_doi.mp3", source: "local" },
        { title: "Một nhà", url: "music/1_nha.mp3", source: "local" },
        { title: "Hơn cả yêu", url: "music/hon_ca_yeu.mp3", source: "local" },
        { title: "Mãi mãi bên nhau", url: "music/mai_mai_ben_nhau.mp3", source: "local" },
        { title: "Ordinary", url: "music/ordinary.mp3", source: "local" },
        { title: "Perfect", url: "music/perfect.mp3", source: "local" },
        { title: "Thinking Out Loud", url: "music/thinking_out_loud.mp3", source: "local" },
        { title: "Váy cưới", url: "music/vay_cuoi.mp3", source: "local" }
    ],

    theme: {
        // Section skins — keys khớp id trong js/modules/*.js (registry).
        // Wish/gift/thanks cố định concept-1; các section còn lại chọn skin độc lập.
        // Xem js/modules/README.md khi thêm section/skin mới.
        primaryColor: BRAND_PRIMARY,
        blocks: {
            cover: "concept-1",
            poster: "concept-1",
            saveDate: "concept-1",
            about: "concept-1",
            timeline: "concept-1",
            gallery: "concept-1",
            countdown: "concept-1",
            divider: "concept-1"
        },
        fonts: {
            body: "quicksand",
            nickname: "great-vibes"
        },
        concepts: {
            "concept-1": {
                images: {
                    background: "img/bg.jpeg",
                    cover: "img/anh_1.jpg",
                    countdown: "img/anh_2.jpg"
                },
                cover: {
                    openLabel: "Mở thiệp"
                }
            },
            "concept-2": {
                images: {
                    background: "img/bg.jpeg",
                    cover: "img/anh_1.jpg",
                    countdown: "img/anh_2.jpg"
                },
                cover: {
                    openLabel: "open invitation"
                }
            },
            "concept-3": {
                images: {
                    background: "img/bg.jpeg",
                    cover: "img/anh_1.jpg",
                    countdown: "img/anh_2.jpg"
                },
                cover: {
                    openLabel: "tap to open"
                }
            },
            "concept-4": {
                images: {
                    background: "img/bg.jpeg",
                    cover: "img/anh_1.jpg",
                    countdown: "img/anh_2.jpg"
                },
                cover: {
                    openLabel: "Chạm để mở"
                }
            }
        }
    },

    // --- Bìa (logo header tự sinh từ nickname, không cấu hình tay) ---
    cover: {
        headline: "TRÂN TRỌNG KÍNH MỜI",
        /** Dòng dưới headline — mọi concept cover; link ?g=index ghi đè bằng guests[i] */
        guest: "Quý khách"
    },

    /**
     * plan: "single" = 1 link (Quý khách); "multi" = link theo guests[]
     * Giá snapshot: payment.amount (admin: amount / amountMulti)
     */
    plan: "single",

    /**
     * Danh sách khách mời (chỉ dùng khi plan === "multi").
     * Firebase: guests: ["Anh A", "Chị B"]
     * Link: /?t=<token>&g=0  → cover.guest = "Anh A"
     */
    guests: [],

    poster: {
        image: "img/anh_1.jpg"
    },

    // --- Ảnh preview khi gửi link Zalo/Facebook/Telegram ---
    preview: {
        image: "img/preview.jpeg"
    },

    // --- Cô dâu & chú rể ---
    groom: {
        nickname: "CHÚ RỂ",
        fullName: "NGUYỄN VĂN A",
        father: "Ông Nguyễn Văn C",
        mother: "Bà Trần Thị D",
        avatar: "img/chu_re.jpeg"
    },

    bride: {
        nickname: "CÔ DÂU",
        fullName: "TRẦN THỊ B",
        father: "Ông Trần Văn E",
        mother: "Bà Nguyễn Thị F",
        avatar: "img/co_dau.jpeg"
    },

    // --- Card đôi nét concept 1 ---
    aboutCard: {
        image: "img/about.jpg",
        script: "First",
        title: "Married",
        groomLabel: "NHÀ TRAI",
        brideLabel: "NHÀ GÁI"
    },

    // --- Tiêu đề & nội dung từng section ---
    sections: {
        saveDate: "SAVE THE DATE",
        about: "ĐÔI NÉT VỀ CHÚNG TÔI",
        timeline: "LỊCH TRÌNH",
        gallery: "ALBUM ẢNH CƯỚI",
        wish: "NHẮN GỬI YÊU THƯƠNG",
        gift: {
            title: "HỘP MỪNG CƯỚI",
            description: "",
            openLabel: "Mở hộp quà"
        },
        countdown: {
            title: "ĐẾM NGƯỢC ĐẾN NGÀY CƯỚI",
            labels: {
                days: "Ngày",
                hours: "Giờ",
                minutes: "Phút",
                seconds: "Giây"
            }
        },
        thanks: {
            title: "XIN CHÂN THÀNH CẢM ƠN",
            paragraphs: []
        }
    },

    // --- Mô tả nhỏ dưới tiêu đề từng section, để trống nếu không dùng ---
    sectionSubtitles: {
        saveDate: "",
        about: "",
        timeline: "",
        gallery: "Hãy để tình yêu diễn biến thật tự nhiên, đã là duyên thì cũng chả sợ lạc đường",
        wish: "Cảm ơn bạn rất nhiều vì đã gửi những lời chúc mừng tốt đẹp nhất đến đám cưới của chúng tôi",
        gift: "Sự hiện diện của bạn là niềm vui lớn nhất đối với chúng tôi. Nếu muốn gửi lời chúc theo một cách đặc biệt hơn, hãy mở hộp quà nhỏ dưới đây.",
        countdown: "",
        thanks: [
            "Cảm ơn bạn đã dành tình cảm cho vợ chồng mình.",
            "Chúng mình biết các bạn đều đang rất bận, bận với công việc, với cuộc sống và với cả gia đình bạn.",
            "Nhưng thực sự sẽ rất tuyệt vời nếu như ngày Hạnh Phúc của chúng mình có thêm sự góp mặt của bạn và người thương. Vợ chồng mình rất hi vọng sẽ có mặt bạn trong ngày quan trọng này để chứng kiến và chia sẻ niềm hạnh phúc này cùng chúng mình.",
            "Một lần nữa, chân thành cảm ơn tất cả các bạn"
        ]
    },

    // --- Form lời chúc ---
    wish: {
        namePlaceholder: "Họ và tên",
        messagePlaceholder: "Gửi lời chúc đến cô dâu và chú rể...",
        submit: "Gửi lời chúc",
        loadMore: "Xem thêm",
        collapse: "Thu gọn",
        attendanceLabel: "Xác nhận tham dự",
        sides: [
            { value: "Bạn cô dâu", icon: "bi-gender-female", color: "palevioletred", default: true },
            { value: "Bạn chú rể", icon: "bi-gender-male", color: "blue" }
        ],
        attendance: [
            { value: "Có tham gia", icon: "✓", default: true },
            { value: "Không tham gia", icon: "×" }
        ],
        validation: {
            noName: "Vui lòng nhập tên.",
            noMessage: "Vui lòng nhập lời chúc."
        },
        messages: {
            success: "Đã gửi lời chúc!",
            error: "Gửi thất bại."
        }
    },

    // --- Lịch trình ngày cưới ---
    ceremony: {
        image: "img/anh_2.jpg",
        mapButtonLabel: "Chỉ đường",
        bride: {
            title: "LỄ VU QUY",
            time: "10:00",
            meal: {
                title: "BỮA CƠM THÂN MẬT",
                time: "17:00 • 11.09.2026"
            },
            address: "Nhà gái - Thôn ABC, Xã DEF, Hà Nội",
            /**
             * Tỉnh/TP nhà gái trên poster (cùng link thiệp với nhà trai)
             * Firebase: ceremony.bride.location — vd "Hà Nội" → "HÀ NỘI"
             * Để "" → suy từ address
             */
            location: "Hà Nội",
            mapUrl: "https://maps.app.goo.gl/YSFromJyb9d6s9wi6"
        },
        groom: {
            title: "LỄ THÀNH HÔN",
            time: "17:00",
            meal: {
                title: "BỮA CƠM THÂN MẬT",
                time: "16:00 • 12.09.2026"
            },
            address: "Nhà trai - Thôn ABC, Xã DEF, Hải Phòng",
            /**
             * Tỉnh/TP nhà trai trên poster
             * Firebase: ceremony.groom.location
             */
            location: "Hải Phòng",
            mapUrl: "https://maps.app.goo.gl/kNT9o3enxq8bn2ow5"
        }
    },

    // --- Album ảnh ---
    gallery: {
        intro: {
            eyebrow: "WELCOME TO OUR",
            script: "love",
            title: "STORY",
            sideText: "SAVE THE DATE"
        },
        photos: [
            { src: "img/anh_3.jpeg", alt: "Ảnh cưới 1" },
            { src: "img/anh_4.jpeg", alt: "Ảnh cưới 2" },
            { src: "img/anh_5.jpeg", alt: "Ảnh cưới 3" },
            { src: "img/anh_6.jpeg", alt: "Ảnh cưới 4" },
            { src: "img/anh_7.jpeg", alt: "Ảnh cưới 5" },
            { src: "img/anh_8.jpeg", alt: "Ảnh cưới 6" },
            { src: "img/anh_1.jpg", alt: "Ảnh cưới 7" },
        ]
    },

    // --- Tài khoản mừng cưới ---
    gift: {
        groom: {
            qr: "img/qr_groom.jpeg",
            bank: "Vietcombank",
            accountName: "NGUYỄN VĂN A",
            accountNumber: "0123456789"
        },
        bride: {
            qr: "img/qr_bride.jpg",
            bank: "Techcombank",
            accountName: "TRẦN THỊ B",
            accountNumber: "9876543210"
        }
    },

    /**
     * Field chỉ builder (Firebase: weddings/{id}.builder).
     * Thiệp public không bắt buộc đọc. weddingId ẩn UI khách; editToken trên link sửa.
     */
    builder: {
        groomNickname: "",
        brideNickname: "",
        /** hex 32 — link sửa /builder/?wedding=…&e=… */
        editToken: "",
        /** fieldName → SHA-256 file gốc (tránh upload Cloudinary trùng khi chọn lại đúng file) */
        mediaFingerprints: {},
        /** public_id Cloudinary đã upload — admin xóa thiệp sẽ cleanup */
        cloudinaryPublicIds: [],
        generatedBaseWeddingId: ""
    }
};

/**
 * Cấu hình thanh toán global (Firebase: settings/payment) — admin chỉnh.
 * Không merge vào wedding; builder đọc để snapshot payment.amount theo plan.
 */
export const paymentSettingsDefaults = {
    amount: 99000,
    amountMulti: 129000,
    currency: "VND",
    contactUrl: "",
    qrImage: "",
    receiver: "",
    /** Nhắc khách CK bằng payment.orderCode (mã GD), không dùng weddingId */
    message: "Vui lòng chuyển khoản đúng số tiền với nội dung là MÃ GIAO DỊCH. Hệ thống sẽ tự mở khóa thiệp sau khi nhận được (SePay). Nếu quá lâu chưa mở, hãy liên hệ admin."
};


export function setWeddingConfig(nextWedding) {
    wedding = nextWedding;
}
