const API_HOST = "eu.posthog.com"; // API host set to "eu.posthog.com" for the EU region

const validOrigins = [
    "https://stage.heimlicher.com",
    "https://simon.heimlicher.com",
    "https://heimlicher.com"
];

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const pathname = url.pathname;
    const search = url.search;
    const pathWithSearch = pathname + search;
    
    let response = null;
    if (pathname.startsWith("/static/")) {
        response = await retrieveStatic(event, pathWithSearch);  // Await the promise
    } else {
        response = await forwardRequest(event, pathWithSearch);  // Await the promise
    }

    // Convert headers to an object for easier logging
    const headersObj = {};
    response.headers.forEach((value, key) => {
        headersObj[key] = value;
    });

    // Log origin, validOrigins, and the formatted response headers
    console.log({
        author: "handleRequest",
        origin: event.request.headers.get('Origin'),  // Log the actual request origin
        validOrigins: validOrigins,
        responseHeaders: headersObj
    });

    return response;
}

async function retrieveStatic(event, pathWithSearch) {
    const origin = event.request.headers.get('Origin');
    // Use a cache key that includes the origin to differentiate between different origins
    const cacheKey = new Request(event.request.url, {
        headers: {
            ...event.request.headers,
            'Origin': origin // Include Origin header in the cache key
        }
    });

    let response = await caches.default.match(cacheKey);

    if (!response) {
        // If not found in cache, fetch the resource
        response = await fetch(`https://${API_HOST}${pathWithSearch}`);
        // Clone the response so we can add custom headers to it
        let newResponse = new Response(response.body, response);
        // Set Cache-Control header for static assets
        newResponse.headers.set('Cache-Control', 'public, max-age=2592000'); // 30 days

        // Add CORS headers
        addCORSHeaders(event, newResponse);

        // Store in the cache with the new cache key (which includes the origin)
        event.waitUntil(caches.default.put(cacheKey, newResponse.clone()));
        return newResponse;
    }

    // If found in cache, apply CORS headers (needed for correct CORS behavior)
    let cachedResponse = response.clone();
    addCORSHeaders(event, cachedResponse);
    return cachedResponse;
}

async function forwardRequest(event, pathWithSearch) {
    let response = await fetch(`https://${API_HOST}${pathWithSearch}`, event.request);
    // Clone the response so we can modify headers
    let newResponse = new Response(response.body, response);
    
    // Add CORS headers
    addCORSHeaders(event, newResponse);
    return newResponse;
}

// Add CORS headers with dynamic origin check
function addCORSHeaders(event, response) {
    const origin = event.request.headers.get('Origin');

    // Check if the origin is valid, and set CORS headers accordingly
    if (origin && validOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin); // Allow specific origin
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
        // If origin is invalid, log it for debugging
        response.headers.set('X-Origin', `Invalid or missing origin: '${origin}'`);
    }

    // Convert headers to an object for easier logging
    const headersObj = {};
    response.headers.forEach((value, key) => {
        headersObj[key] = value;
    });

    // Log origin, validOrigins, and the formatted response headers
    console.log({
        author: "addCORSHeaders",
        origin: origin,
        validOrigins: validOrigins,
        responseHeaders: headersObj
    });
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
