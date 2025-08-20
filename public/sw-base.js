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

workboxSW.precache([]);

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
