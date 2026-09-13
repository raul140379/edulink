// Service worker mínimo — necesario para que Chrome/Android reconozca la app
// como instalable de verdad (uno de los criterios reales de instalación es
// un SW registrado con un handler de fetch, sin él el navegador no ofrece
// "Instalar", cae a otro comportamiento como el que reportó Raul). Sin
// caché offline real todavía a propósito: asistencia/notificaciones
// necesitan conexión en vivo, así que por ahora es un passthrough de red.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
