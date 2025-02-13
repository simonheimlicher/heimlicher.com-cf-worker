const API_HOST = "eu.posthog.com"; // Change to "eu.posthog.com" for the EU region

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const pathname = url.pathname;
    const search = url.search;
    const pathWithParams = pathname + search;

    let response;
    if (pathname.startsWith("/static/")) {
        response = await retrieveStatic(event, pathWithParams);
    } else {
        response = await forwardRequest(event, pathWithParams);
    }

    // Ensure CORS headers are applied to ALL responses
    return addCORSHeaders(response);
}

async function retrieveStatic(event, pathname) {
    let response = await caches.default.match(event.request);
    if (!response) {
        response = await fetch(`https://${API_HOST}${pathname}`);
        response = new Response(response.body, response);

        // Set Cache-Control header for static assets
        response.headers.set("Cache-Control", "public, max-age=2592000"); // 30 days

        event.waitUntil(caches.default.put(event.request, response.clone()));
    }

    return response;
}

async function forwardRequest(event, pathWithSearch) {
    const request = new Request(event.request);
    request.headers.delete("cookie");
    let response = await fetch(`https://${API_HOST}${pathWithSearch}`, request);
    return response;
}

// Function to add CORS headers
function addCORSHeaders(response) {
    let newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return newResponse;
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
