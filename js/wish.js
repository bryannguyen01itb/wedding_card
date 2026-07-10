let allWishes = [];

let expanded = false;

const wishFormElements = {
    name: document.getElementById("wishName"),
    message: document.getElementById("wishMessage"),
    button: document.getElementById("wishBtn"),
    list: document.getElementById("wishList"),
    loadMore: document.getElementById("loadMoreBtn")
};

function getCheckedValue(name){

    return document.querySelector(`input[name="${name}"]:checked`)?.value || "";

}

function resetWishForm(){

    wishFormElements.name.value = "";

    wishFormElements.message.value = "";

    const defaultAttendance = document.querySelector('input[name="attendance"][value="Có tham gia"]');

    if(defaultAttendance){

        defaultAttendance.checked = true;

    }

}

function getWishFormData(){

    return {
        name: wishFormElements.name.value.trim(),
        side: getCheckedValue("side"),
        attendance: getCheckedValue("attendance"),
        message: wishFormElements.message.value.trim()
    };

}

function validateWish(data){

    if(data.name === ""){

        alert("Vui lòng nhập tên.");

        return false;

    }

    if(data.message === ""){

        alert("Vui lòng nhập lời chúc.");

        return false;

    }

    return true;

}

function sendWish(){

    const data = getWishFormData();

    if(!validateWish(data)){

        return;

    }

    db.collection("wishes").add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {

        alert("Đã gửi lời chúc!");

        resetWishForm();

    })
    .catch(error => {

        console.error(error);

        alert("Gửi thất bại.");

    });

}

function formatWishTime(createdAt){

    if(createdAt && typeof createdAt.toDate === "function"){

        return createdAt.toDate().toLocaleString("vi-VN");

    }

    return "";

}

function createElement(className, text){

    const element = document.createElement("div");

    element.className = className;

    if(text !== undefined){

        element.textContent = text;

    }

    return element;

}

function createWishCard(data){

    const name = data.name || "Khách mời";

    const side = data.side || "";

    const attendance = data.attendance || "Chưa xác nhận";

    const card = createElement("wish-card");

    const header = createElement("wish-header");

    const avatar = createElement("avatar", name.charAt(0).toUpperCase());

    const userInfo = createElement("user-info");

    const attendanceClass = attendance === "Có tham gia"
        ? "attendance-badge attending"
        : "attendance-badge absent";

    userInfo.appendChild(createElement("user-name", name));

    userInfo.appendChild(createElement("user-side", side));

    userInfo.appendChild(createElement(attendanceClass, attendance));

    header.appendChild(avatar);

    header.appendChild(userInfo);

    card.appendChild(header);

    card.appendChild(createElement("wish-message", data.message || ""));

    card.appendChild(createElement("wish-time", formatWishTime(data.createdAt)));

    return card;

}

function updateLoadMoreButton(){

    if(allWishes.length <= 3){

        wishFormElements.loadMore.style.display = "none";

        return;

    }

    wishFormElements.loadMore.style.display = "block";

    wishFormElements.loadMore.textContent = expanded
        ? "Thu gọn"
        : `Xem tất cả lời chúc (${allWishes.length})`;

    wishFormElements.loadMore.classList.toggle("collapse", expanded);

}

function renderWish(){

    wishFormElements.list.textContent = "";

    const wishes = expanded ? allWishes : allWishes.slice(0, 3);

    wishes.forEach(data => {

        wishFormElements.list.appendChild(createWishCard(data));

    });

    updateLoadMoreButton();

}

function loadWish(){

    db.collection("wishes")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {

            allWishes = [];

            snapshot.forEach(doc => {

                allWishes.push(doc.data());

            });

            renderWish();

        });

}

wishFormElements.button?.addEventListener("click", sendWish);

wishFormElements.loadMore?.addEventListener("click", () => {

    expanded = !expanded;

    renderWish();

});

loadWish();
