/**
 * Cấu hình nội dung thiệp cưới.
 * Chỉnh sửa file này để thay đổi toàn bộ thông tin hiển thị trên thiệp.
 */
export let wedding = {
    // --- Thông tin chung ---
    weddingId: "wedding-cp-4",
    date: "2026-09-12",
    location: "HẢI PHÒNG, VIỆT NAM",
    music: "music/1_doi.mp3",

    theme: {
        // concept-1: giao diện gốc, concept-2: Botanical Airy, concept-3: Sunset Pop, concept-4: MeHappy Soft
        concept: "concept-3",
        primaryColor: "#8fb8a8",
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

    // --- Giao diện bìa & poster ---
    header: {
        logo: "C & C"
    },

    cover: {
        headline: "TRÂN TRỌNG KÍNH MỜI"
    },

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
            address: "Nhà gái - Thôn ABC, Xã DEF, Hải Phòng",
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
    }
};


export function setWeddingConfig(nextWedding) {
    wedding = nextWedding;
}
