const enableNotificationsButtons = document.querySelectorAll(
  '.enable-notifications'
);

let deferredPrompt;

if (!window.Promise) window.Promise = Promise;

if ('serviceWorker' in navigator)
  navigator.serviceWorker
    .register('/service-worker.js')
    .then(() => console.log('Service worker registered!'))
    .catch((err) => console.log(err));

window.addEventListener('beforeinstallprompt', function (event) {
  console.log('beforeinstallprompt fired');
  event.preventDefault();
  if (deferredPrompt === undefined) deferredPrompt = event;
  return false;
});

function displayConfirmationNotification() {
  if ('serviceWorker' in navigator) {
    const options = {
      body: 'You successfully subscribed to our Notification server :)',
      lang: 'en-US',
      dir: 'ltr',

      icon: '/src/images/icons/app-icon-96x96.png',
      badge: '/src/images/icons/app-icon-96x96.png',
      image: '/src/images/sf-boat.jpg',

      vibrate: [100, 50, 200],

      tag: 'confirm-notification',
      renotify: true,

      actions: [
        { action: 'confirm', title: 'Okay' },
        { action: 'cancel', title: 'Cancel' },
      ],
    };

    navigator.serviceWorker.ready.then((sw) =>
      sw.showNotification('subscribed successfully!', options)
    );
  }
}

function configurePushSub() {
  let reg;

  navigator.serviceWorker.ready
    .then((sw) => {
      reg = sw;
      return sw.pushManager.getSubscription();
    })
    .then((subscription) => {
      if (!subscription) {
        const vapidPublicKey =
          'BEfFO4nZ8lFmcoIT7vZ9GyXOaMsYcNgVBCzug043zbpefQu0P71kkQ2TNfdiXWssucxdm2i0LZVAjn1RGcBrPpw';

        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
    })
    .then((newSub) => newSub && saveSubscriptionToSupabase(newSub))
    .then(() => displayConfirmationNotification())
    .catch((error) => console.log(error));
}

function sendRequestPremission() {
  Notification.requestPermission((result) => {
    console.log('User Choice:', result);

    if (result === 'denied') console.log('User denied the premission :(');
    else configurePushSub();
  });
}

if ('Notification' in window && 'serviceWorker' in navigator)
  enableNotificationsButtons.forEach((button) => {
    button.style.display = 'inline-block';
    button.addEventListener('click', sendRequestPremission);
  });
