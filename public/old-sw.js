importScripts('/src/js/idb.js');
importScripts('/src/js/utils.js');
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

const supabaseUrl = 'https://hacfwnavusmqtubdtkan.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhY2Z3bmF2dXNtcXR1YmR0a2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDY4NjAsImV4cCI6MjA3MDU4Mjg2MH0.iALosAfpwYK8lMx3gpHj0NZ4RZdw5e6eYqD2vVdobyc';
const supabaseDB = supabase.createClient(supabaseUrl, supabaseAnonKey);

var CACHE_STATIC_NAME = 'static-v2';
var CACHE_DYNAMIC_NAME = 'dynamic-v2';
var STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/js/idb.js',
  '/src/js/supabase.js',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/promise.js',
  '/src/js/fetch.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/main-image.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
];

function isInArray(string, array) {
  var cachePath;
  if (string.indexOf(self.origin) === 0) {
    cachePath = string.substring(self.origin.length);
  } else {
    cachePath = string;
  }
  return array.indexOf(cachePath) > -1;
}

self.addEventListener('install', function (event) {
  console.log('[Service Worker] Installing Service Worker ...', event);
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then(function (cache) {
      console.log('[Service Worker] Precaching App Shell');
      cache.addAll(STATIC_FILES);
    })
  );
});

self.addEventListener('activate', function (event) {
  console.log('[Service Worker] Activating Service Worker ....', event);
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
            console.log('[Service Worker] Removing old cache.', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const url = 'https://hacfwnavusmqtubdtkan.supabase.co/rest/v1/posts';

  if (event.request.url.startsWith(url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const cloneRes = res.clone();

          clearAllData('posts')
            .then(() => cloneRes.json())
            .then((data) => data?.forEach((post) => writeData('posts', post)));

          return res;
        })
        .catch(() => {})
    );
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    event.respondWith(caches.match(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        if (response) {
          return response;
        } else {
          return fetch(event.request)
            .then(function (res) {
              return caches.open(CACHE_DYNAMIC_NAME).then(function (cache) {
                cache.put(event.request.url, res.clone());
                return res;
              });
            })
            .catch(function (err) {
              return caches.open(CACHE_STATIC_NAME).then(function (cache) {
                if (event.request.headers.get('accept').includes('text/html'))
                  return cache.match('/offline.html');
              });
            });
        }
      })
    );
  }
});

self.addEventListener('sync', function (event) {
  console.log('[Service Worker] background syncing...', event);
  if (event.tag === 'sync-new-post') {
    console.log('[Service Worker] syncing new Posts...');
    event.waitUntil(
      readAllData('sync-posts').then((posts) => {
        console.log(posts);

        posts.forEach((post) => {
          const imageName = `${Math.random()}-${post.image.name}`.replaceAll(
            '/',
            ''
          );
          const imagePath = `https://hacfwnavusmqtubdtkan.supabase.co/storage/v1/object/public/post-images/${imageName}`;

          supabaseDB
            .from('posts')
            .insert({ ...post, image: imagePath })
            .then(({ error }) => {
              if (error)
                throw new Error(`Something bad happened! ${error.message} ⛔`);
              clearData('sync-posts', post.id);

              supabaseDB.storage
                .from('post-images')
                .upload(imageName, post.image)
                .then((storage) => {
                  if (storage.error) {
                    supabaseDB.from('posts').delete().eq('id', post.id);
                    throw new Error(
                      `Failed to store your image! ${storage.error}`
                    );
                  }
                });
            })
            .catch((error) => console.log(error));
        });
      })
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  const notification = event.notification;
  const action = event.action;

  if (action === 'confirm') console.log('Confirm clicked ✅');
  else {
    event.waitUntil(
      clients.matchAll().then((clis) => {
        const client = clis.find((c) => c.visibilityState === 'visible');

        if (client) {
          client.navigate(notification.data.url);
          client.focus();
        } else {
          clients.openWindow(notification.data.url);
        }
      })
    );
  }

  notification.close();
});

self.addEventListener('notificationclose', function (event) {
  console.log('Notification was closed :(', event);
});

self.addEventListener('push', function (event) {
  let data = {
    title: 'New!',
    body: 'Something new happened!',
    redirectTo: '/',
    icon: '/src/images/icons/app-icon96x96.png',
    badge: '/src/images/icons/app-icon96x96.png',
  };
  if (event.data) data = JSON.parse(event.data.text());

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: {
      url: data.redirectTo,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
