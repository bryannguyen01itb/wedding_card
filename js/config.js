/** Cấu hình nội dung thiệp cưới — chỉnh sửa file này để thay đổi thông tin */
export const wedding = {
    date: "2026-09-12",

    theme: {
        primaryColor: "#8fb8a8"
    },

    location: "HẢI PHÒNG, VIỆT NAM",
    music: "music/1_doi.mp3",

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

    ceremony: {
        image: "img/anh_2.jpg",
        bride: {
            title: "LỄ VU QUY",
            time: "10:00",
            meal: {
                title: "BỮA CƠM THÂN MẬT",
                time: "17:00 • 11.09.2026"
            },
            address: "Nhà gái - Thôn ABC, Xã DEF, Hải Phòng"
        },
        groom: {
            title: "LỄ THÀNH HÔN",
            time: "17:00",
            meal: {
                title: "BỮA CƠM THÂN MẬT",
                time: "16:00 • 12.09.2026"
            },
            address: "Nhà trai - Thôn ABC, Xã DEF, Hải Phòng"
        }
    },

    gallery: [
        { type: "image", src: "img/anh_3.jpeg", size: "wide" },
        { type: "text", title: "My story", subtitle: "From this day forward" },
        { type: "image", src: "img/anh_4.jpeg", size: "tall" },
        { type: "image", src: "img/anh_5.jpeg" },
        { type: "image", src: "img/anh_6.jpeg" },
        { type: "text", title: "Forever love", subtitle: "Our little forever" },
        { type: "image", src: "img/anh_7.jpeg", size: "tall" },
        { type: "image", src: "img/anh_8.jpeg" },
        { type: "image", src: "img/anh_1.jpeg" }
    ],

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
