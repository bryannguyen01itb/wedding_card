function getElement(id){

    return document.getElementById(id);

}

function setText(id, value){

    const element = getElement(id);

    if(element){

        element.textContent = value;

    }

}

function setSrc(id, value){

    const element = getElement(id);

    if(element){

        element.src = value;

    }

}

function formatDate(dateString){

    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, "0");

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const year = date.getFullYear();

    return `${day}.${month}.${year}`;

}

function hexToRgb(hex){

    const cleanHex = hex.replace("#", "");

    const normalizedHex = cleanHex.length === 3
        ? cleanHex.split("").map(char => char + char).join("")
        : cleanHex;

    const value = parseInt(normalizedHex, 16);

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };

}

function darkenHex(hex, percent){

    const rgb = hexToRgb(hex);

    const ratio = 1 - percent / 100;

    const toHex = value => Math.round(value * ratio)
        .toString(16)
        .padStart(2, "0");

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;

}

function applyTheme(){

    const primaryColor = wedding.theme?.primaryColor || "#8fb8a8";

    const rgb = hexToRgb(primaryColor);

    document.documentElement.style.setProperty("--primary-color", primaryColor);

    document.documentElement.style.setProperty(
        "--primary-rgb",
        `${rgb.r}, ${rgb.g}, ${rgb.b}`
    );

    document.documentElement.style.setProperty(
        "--primary-hover",
        darkenHex(primaryColor, 10)
    );

}

function formatEventTime(time){

    return `${time} • ${formatDate(wedding.date)}`;

}

function renderPerson(type, person){

    setSrc(`${type}Avatar`, person.avatar);

    setText(`${type}Name`, person.fullName);

    setText(`${type}Father`, `Con ông: ${person.father}`);

    setText(`${type}Mother`, `và bà: ${person.mother}`);

}

function renderTimelineEvent(type, event){

    setSrc(`${type}EventImage`, wedding.ceremony.image);

    setText(`${type}EventTitle`, event.title);

    setText(`${type}EventTime`, formatEventTime(event.time));

    setText(`${type}MealTitle`, event.meal.title);

    setText(`${type}MealTime`, event.meal.time);

    setText(`${type}EventAddress`, event.address);

}

function renderGift(type, gift){

    setSrc(`${type}QR`, gift.qr);

    setText(`${type}Bank`, gift.bank);

    setText(`${type}AccountName`, gift.accountName);

    setText(`${type}AccountNumber`, gift.accountNumber);

}

function createGalleryImage(item){

    const image = document.createElement("img");

    image.src = item.src;

    image.alt = item.alt || "";

    return image;

}

function createGalleryText(item){

    const title = document.createElement("div");

    title.className = "gallery-text__title";

    title.textContent = item.title || "";

    const subtitle = document.createElement("div");

    subtitle.className = "gallery-text__subtitle";

    subtitle.textContent = item.subtitle || "";

    const content = document.createElement("div");

    content.className = "gallery-text__content";

    content.appendChild(title);

    content.appendChild(subtitle);

    return content;

}

function renderGallery(items){

    const galleryGrid = document.querySelector(".gallery-grid");

    if(!galleryGrid){

        return;

    }

    galleryGrid.textContent = "";

    items.forEach((item, index) => {

        const normalizedItem = typeof item === "string"
            ? { type: "image", src: item }
            : item;

        const tile = document.createElement("div");

        tile.className = `gallery-item ${normalizedItem.type === "text" ? "gallery-text" : "gallery-photo"}`;

        if(normalizedItem.size){

            tile.classList.add(`gallery-item--${normalizedItem.size}`);

        }

        tile.appendChild(normalizedItem.type === "text"
            ? createGalleryText(normalizedItem)
            : createGalleryImage(normalizedItem));

        galleryGrid.appendChild(tile);

    });

}

applyTheme();

setText("coverGroom", wedding.groom.nickname);
setText("coverBride", wedding.bride.nickname);
setText("posterGroom", wedding.groom.nickname);
setText("posterBride", wedding.bride.nickname);
setText("coverDate", formatDate(wedding.date));
setText("posterDate", formatDate(wedding.date));
setText("posterLocation", wedding.location);

renderPerson("groom", wedding.groom);
renderPerson("bride", wedding.bride);

renderTimelineEvent("bride", wedding.ceremony.bride);
renderTimelineEvent("groom", wedding.ceremony.groom);

renderGallery(wedding.gallery);

renderGift("groom", wedding.gift.groom);
renderGift("bride", wedding.gift.bride);
