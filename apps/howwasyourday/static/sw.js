const CACHE_VERSION = "v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "How Was Your Day?", body: event.data.text() };
  }

  const options = {
    body: data.body || "Take a moment to reflect on today",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/" },
    tag: "hwyd-daily-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "How Was Your Day?", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
