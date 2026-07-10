const audio = document.getElementById("bgMusic");

const musicButton = document.getElementById("musicBtn");

let playing = false;

if(audio){

    audio.src = wedding.music;

}

function setMusicPlaying(isPlaying){

    playing = isPlaying;

    musicButton?.classList.toggle("playing", isPlaying);

}

function showMusic(){

    musicButton?.classList.add("show");

}

function playMusic(){

    if(!audio){

        return;

    }

    audio.play()
        .then(() => {

            setMusicPlaying(true);

        })
        .catch(error => {

            setMusicPlaying(false);

            console.warn("Không thể tự động phát nhạc:", error);

        });

}

function pauseMusic(){

    if(!audio){

        return;

    }

    audio.pause();

    setMusicPlaying(false);

}

musicButton?.addEventListener("click", () => {

    if(playing){

        pauseMusic();

    }else{

        playMusic();

    }

});
