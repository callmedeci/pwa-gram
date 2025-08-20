importScripts('workbox-sw.prod.v2.1.3.js');
importScripts('/src/js/idb.js');
importScripts('/src/js/utils.js');
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

const supabaseUrl = 'https://hacfwnavusmqtubdtkan.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhY2Z3bmF2dXNtcXR1YmR0a2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDY4NjAsImV4cCI6MjA3MDU4Mjg2MH0.iALosAfpwYK8lMx3gpHj0NZ4RZdw5e6eYqD2vVdobyc';
const supabaseDB = supabase.createClient(supabaseUrl, supabaseAnonKey);

const workboxSW = new self.WorkboxSW();

workboxSW.router.registerRoute(
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'supabase-cdn',
  })
);

workboxSW.router.registerRoute(
  /.*(?:googleapis|gstatic)\.com.*$/,
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'google-fonts',
    cacheExpiration: {
      maxEntries: 4,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    },
  }) //CAHE-THEN-NETWORK
);

workboxSW.router.registerRoute(
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'material-css',
  })
);

workboxSW.router.registerRoute(
  /^https:\/\/hacfwnavusmqtubdtkan\.supabase\.co\/storage\/v1\/object\/public\/post-images\/.+$/,
  workboxSW.strategies.staleWhileRevalidate({
    cacheName: 'post-images',
  })
);

workboxSW.router.registerRoute(
  'https://hacfwnavusmqtubdtkan.supabase.co/rest/v1/posts?select=*',
  function (args) {
    return fetch(args.event.request).then((res) => {
      const cloneRes = res.clone();

      clearAllData('posts')
        .then(() => cloneRes.json())
        .then((data) => data?.forEach((post) => writeData('posts', post)));

      return res;
    });
  }
);

workboxSW.router.registerRoute(
  function (routeData) {
    return routeData.event.request.headers.get('accept').includes('text/html');
  },
  function (args) {
    return caches.match(args.event.request).then(function (response) {
      if (response) return response;
      else {
        return fetch(args.event.request)
          .then(function (res) {
            return caches.open('dynamic').then(function (cache) {
              cache.put(args.event.request.url, res.clone());
              return res;
            });
          })
          .catch(() => caches.match('/offline.html').then((res) => res));
      }
    });
  }
);

// workboxSW.router.registerRoute(/.*(?:nominatim)\.org.*$/);

workboxSW.precache([
  {
    "url": "favicon.ico",
    "revision": "2cab47d9e04d664d93c8d91aec59e812"
  },
  {
    "url": "index.html",
    "revision": "03fecc65fba877d014b97f802e9d4e6d"
  },
  {
    "url": "manifest.json",
    "revision": "d11c7965f5cfba711c8e74afa6c703d7"
  },
  {
    "url": "offline.html",
    "revision": "20345b910d21459f0e4e5e2b0582c005"
  },
  {
    "url": "src/css/app.css",
    "revision": "d2b3465746d26904a4f6e2c2c1632ce6"
  },
  {
    "url": "src/css/feed.css",
    "revision": "c2c0dd49b2847f985d827c57aa59eeb9"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/images/main-image-lg.jpg",
    "revision": "31b19bffae4ea13ca0f2178ddb639403"
  },
  {
    "url": "src/images/main-image-sm.jpg",
    "revision": "c6bb733c2f39c60e3c139f814d2d14bb"
  },
  {
    "url": "src/images/main-image.jpg",
    "revision": "5c66d091b0dc200e8e89e56c589821fb"
  },
  {
    "url": "src/images/sf-boat.jpg",
    "revision": "0f282d64b0fb306daf12050e812d6a19"
  },
  {
    "url": "src/js/app.min.js",
    "revision": "c793c25287b06b42a852581819e62bea"
  },
  {
    "url": "src/js/feed.min.js",
    "revision": "261aca679fefbccffd687467d47ed891"
  },
  {
    "url": "src/js/fetch.min.js",
    "revision": "f258cf8e71371bd6f158a7fffe7df405"
  },
  {
    "url": "src/js/idb.min.js",
    "revision": "d8dd6e8a931d2a556beeaae3bb16c985"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/promise.min.js",
    "revision": "f874d37f9e9202ba09b3f2e4995c4827"
  },
  {
    "url": "src/js/supabase.min.js",
    "revision": "281af0a0f63109134a193ee09f93936d"
  },
  {
    "url": "src/js/utils.min.js",
    "revision": "a78cc6198e517f88e6d8061a0e8548da"
  }
]);

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
