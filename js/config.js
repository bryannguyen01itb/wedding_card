/**
 * Cấu hình nội dung thiệp cưới (mẫu local + tham chiếu field Firebase).
 *
 * === Schema Firebase (weddings/{weddingId}) — field quan trọng ===
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
 * 3) Link thiệp sau thanh toán (không đoán được)
 *    - payment.accessToken      — chuỗi hex 32 ký tự (random)
 *    - payment.unlocked / payment.status — "paid" + unlocked:true mới mở thiệp public
 *    - payment.amount, payment.currency — số tiền snapshot lúc tạo đơn
 *    - payment.plan — "single" | "multi" (gói đã chọn lúc snapshot giá)
 *    Link 1 khách: /?t=<accessToken>
 *    Link multi:   /?t=<accessToken>&g=0  (&g=1, &g=2…)
 *    Link sửa:     /builder/?wedding=<weddingId>
 *
 * 4) Public ?wedding=<id> chỉ xem được khi đã paid (chống đoán id bỏ qua thanh toán)
 *
 * 5) builder (chỉ builder dùng, thiệp public có thể bỏ qua)
 *    - builder.groomNickname, builder.brideNickname
 *    - builder.mediaFingerprints — map field → hash file để không re-upload Cloudinary trùng
 *    - builder.generatedBaseWeddingId
 *
 * 6) Vòng đời / dọn admin
 *    - createdAt, updatedAt — serverTimestamp (admin xóa thiệp > 30 ngày theo mốc này)
 *    - Subcollection: weddings/{id}/wishes — lời chúc (xóa thiệp sẽ xóa luôn wishes)
 *
 * === settings/payment (doc global admin, không nằm trong wedding) ===
 *    - amount       — giá gói 1 link (mặc định 99000)
 *    - amountMulti  — giá gói nhiều link (mặc định 129000)
 *    - currency, contactUrl, qrImage, receiver, message
 */
export let wedding = {
    // --- Thông tin chung ---
    weddingId: "wedding-cp-4",
    date: "2026-09-12",
    music: "music/1_doi.mp3",

    /**
     * Thanh toán / mở khóa (Firebase: weddings/{id}.payment)
     * amount + plan: snapshot lúc Lưu Firebase (từ settings/payment theo gói).
     */
    payment: {
        status: "pending", // "pending" | "paid" | "locked"
        unlocked: false,
        /** "single" | "multi" — gói thiệp lúc snapshot giá */
        plan: "single",
        /** Số tiền snapshot (99k / 129k hoặc giá admin cấu hình) */
        amount: 99000,
        currency: "VND",
        /** Random 32 hex — generate khi lưu builder / admin mở khóa */
        accessToken: ""
    },

    // --- Thư viện nhạc local (folder music/) ---
    // Thêm file mp3 vào music/ rồi khai báo ở đây. Builder gộp thêm bài từ Firebase musicLibrary (Cloudinary).
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
        primaryColor: "#8fb8a8",
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
     * Thiệp public không bắt buộc đọc.
     */
    builder: {
        groomNickname: "",
        brideNickname: "",
        /** fieldName → SHA-256 file gốc (tránh upload Cloudinary trùng khi chọn lại đúng file) */
        mediaFingerprints: {},
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
    message: "Vui lòng chuyển khoản với nội dung là Wedding ID, sau đó liên hệ admin để được mở khóa link thiệp."
};


export function setWeddingConfig(nextWedding) {
    wedding = nextWedding;
}
