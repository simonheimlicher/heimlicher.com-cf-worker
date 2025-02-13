// const API_HOST = "app.posthog.com" // Change to "eu.posthog.com" for the EU region
const API_HOST = "eu.posthog.com"; // Change to "eu.posthog.com" for the EU region

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const pathname = url.pathname;
    const search = url.search;
    const pathWithParams = pathname + search;

    if (pathname.startsWith("/static/")) {
        return retrieveStatic(event, pathWithParams);
    } else {
        return forwardRequest(event, pathWithParams);
    }
}

async function retrieveStatic(event, pathname) {
    let response = await caches.default.match(event.request);
    if (!response) {
        response = await fetch(`https://${API_HOST}${pathname}`);
        // Clone the response so we can modify headers
        response = new Response(response.body, response);

        // Set CORS headers
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type");

        // Set Cache-Control header for static assets
        response.headers.set("Cache-Control", "public, max-age=2592000"); // 30 days

        event.waitUntil(caches.default.put(event.request, response.clone()));
    }

    return response;
}

async function forwardRequest(event, pathWithSearch) {
    const request = new Request(event.request);
    request.headers.delete("cookie");
    return await fetch(`https://${API_HOST}${pathWithSearch}`, request);
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
