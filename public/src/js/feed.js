const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector(
  '#close-create-post-modal-btn'
);
const sharedMomentsArea = document.querySelector('#shared-moments');
const snackBarContainer = document.querySelector('#confirmation-toast');
const form = document.querySelector('form');
const titleInput = document.querySelector('#title');
const locationInput = document.querySelector('#location');
const videoPlayer = document.querySelector('#player');
const canvasEl = document.querySelector('#canvas');
const captureBtn = document.querySelector('#capture-btn');
const imagePicker = document.querySelector('#image-picker');
const imagePickerArea = document.querySelector('#pick-image');
const locationBtn = document.querySelector('#location-btn');
const locationLoader = document.querySelector('#location-loader');

const manualLocation = document.querySelector('#manual-location');

let picture = null;
let fetchLocation = null;

function closeCreatePostModal() {
  createPostArea.style.transform = 'translateY(100vh)';
  videoPlayer.style.display = 'none';
  imagePickerArea.style.display = 'none';
  canvasEl.style.display = 'none';
  locationBtn.style.display = 'inline';
  locationLoader.style.display = 'none';
  videoPlayer?.srcObject?.getVideoTracks()?.forEach((track) => track.stop());
}

function clearCards() {
  while (sharedMomentsArea.hasChildNodes())
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
}

function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';
  cardTitle.style.backgroundImage = 'url(' + data.image + ')';
  cardTitle.style.backgroundSize = 'cover';

  cardWrapper.appendChild(cardTitle);
  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);
  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';
  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(data) {
  clearCards();
  data.forEach((post) => createCard(post));
}

function handleGetLocation() {
  locationBtn.style.display = 'none';
  locationLoader.style.display = 'block';
  navigator.geolocation.getCurrentPosition(
    function (position) {
      locationBtn.style.display = 'inline';
      locationLoader.style.display = 'none';
      const { latitude: lat, longitude: lng } = position.coords;

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          const { display_name } = data;

          fetchLocation = display_name;
          locationInput.value = display_name;
          locationInput.classList.add('is-focused');
          manualLocation.classList.add('is-focused');
        })
        .catch((err) => console.error(err));
    },

    function (error) {
      console.log(error);

      locationBtn.style.display = 'inline';
      locationLoader.style.display = 'none';

      fetchLocation = null;
      locationInput.value = '';
      locationInput.classList.remove('is-focused');
      manualLocation.classList.remove('is-focused');

      alert("Couldn't get your location");
    },
    { timeout: 7 * 1000 }
  );
}

function initializeLocation() {
  if (!('geolocation' in navigator)) locationBtn.style.display = 'none';
}

function handleCaptureImage(event) {
  event.preventDefault();
  canvasEl.style.display = 'block';
  videoPlayer.style.display = 'none';
  captureBtn.style.display = 'none';

  const context = canvasEl.getContext('2d');
  context.drawImage(
    videoPlayer,
    0,
    0,
    canvasEl.width,
    videoPlayer.videoHeight / (videoPlayer.videoWidth / canvasEl.width)
  );

  videoPlayer.srcObject.getVideoTracks().forEach((track) => track.stop());

  canvasEl.toBlob((blob) => {
    const uuid = crypto.randomUUID();
    picture = new File([blob], `${uuid}-picture`, { type: 'image/jpg' });
  });
}

function handlePickImage(event) {
  picture = event.target.files[0];
}

async function initializeMedia() {
  if (!('mediaDevices' in navigator)) navigator.mediaDevices = {};

  if (!('getUserMedia' in navigator.mediaDevices)) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      const getUserMedia =
        navigator.webKitGetUserMedia || navigator.mozGetUserMedia;

      if (!getUserMedia)
        return Promise.reject(new Error('can not access to media'));

      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    videoPlayer.srcObject = stream;
    videoPlayer.style.display = 'block';
  } catch (error) {
    console.log(error);
    imagePickerArea.style.display = 'block';
  }
}

// Currently not in use, allows to save assets in cache on demand otherwise
async function onSaveButtonClicked(event) {
  console.log('clicked');
  if ('caches' in window) {
    const cache = await caches.open('user-requested');

    cache.add('https://httpbin.org/get');
    cache.add('/src/images/sf-boat.jpg');
  }
}

async function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0)';
  await initializeMedia();
  initializeLocation();

  if (deferredPrompt) {
    deferredPrompt.prompt();

    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'dismissed') {
      console.log('User cancelled installation');
    } else {
      console.log('User added to home screen');
    }

    deferredPrompt = null;
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const { title, location } = Object.fromEntries(formData.entries());

  if (title.trim() === '' || location.trim() === '')
    return alert('Please enter valid data');

  closeCreatePostModal();
  const SuccessData = { message: 'Your Post saved for syncing!' };
  const failureData = { message: "Oops, something wen't wrong" };

  if ('serviceWorker' in navigator && 'indexedDB' in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      const post = {
        id: crypto.randomUUID(),
        title,
        location,
        image: picture,
      };

      await writeData('sync-posts', post);
      await sw.sync.register('sync-new-post');

      captureBtn.style.display = 'block';

      snackBarContainer.MaterialSnackbar.showSnackbar(SuccessData);
    } catch {
      snackBarContainer.MaterialSnackbar.showSnackbar(failureData);
    }
  } else {
    console.log('DO NOT HAVE SW Enabled!!!');
    const newPost = {
      title,
      location,
      image: picture,
    };
    try {
      await createNewPost(newPost);

      const posts = await getAllPosts();
      snackBarContainer.MaterialSnackbar.showSnackbar(SuccessData);
      updateUI(posts);
    } catch (error) {
      console.log(error);
      snackBarContainer.MaterialSnackbar.showSnackbar(failureData);
    }
  }
}

(async function () {
  let networkDataReceived = false;

  try {
    const data = await getAllPosts();
    if (data) {
      networkDataReceived = true;
      updateUI(data);
    }
  } catch (error) {
    console.log('ERROR ⛔', error);
  }

  if ('indexedDB' in window) {
    const posts = await readAllData('posts');
    if (!networkDataReceived) updateUI(posts);
  }
})();

form.addEventListener('submit', handleSubmit);
shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
captureBtn.addEventListener('click', handleCaptureImage);
imagePicker.addEventListener('change', handlePickImage);
locationBtn.addEventListener('click', handleGetLocation);
