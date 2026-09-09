self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Malformed or missing payload — fall back to defaults below.
  }

  const title = data.title || "Expense Ledger";
  const options = {
    body: data.body || "",
    icon: "/vite.svg",
    badge: "/vite.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});