// === Global Constants ===
const DEBUG = true;

// Set API host to "eu.posthog.com" for the EU region
const API_HOST = "eu.posthog.com";

const validOrigins = [
    "https://stage.heimlicher.com",
    "https://simon.heimlicher.com",
    "https://heimlicher.com"
];

// Cache header constants
const CACHE_HEADER_CONTROL = "public, max-age=2592000, stale-while-revalidate";
const CACHE_HEADER_VARY = "Origin";

// CORS header constants
const CORS_HEADER_ALLOW_METHODS = "GET, POST, OPTIONS";
const CORS_HEADER_ALLOW_HEADERS = "Content-Type";
const CORS_HEADER_ALLOW_CREDENTIALS = "true";
const CORS_HEADER_VARY = "Origin";

// === Main Request Handler ===
async function handleRequest(event) {
    const request = event.request;

    // Handle CORS preflight request
    if (request.method === "OPTIONS") {
        return handlePreflight(request);
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const pathWithSearch = pathname + url.search;

    const response = pathname.startsWith("/static/")
        ? await retrieveStatic(event, pathWithSearch)
        : await forwardRequest(event, pathWithSearch);

    if (DEBUG) logResponse("handleRequest", request, response);
    return response;
}

// === Static Resource Caching ===
async function retrieveStatic(event, pathWithSearch) {
    const origin = event.request.headers.get("Origin");

    const cacheKey = new Request(event.request.url, {
        headers: { ...event.request.headers, "Origin": origin }
    });

    let response = await caches.default.match(cacheKey);

    if (!response) {
        // If not found in cache, fetch the resource
        response = await fetch(`https://${API_HOST}${pathWithSearch}`);
        // Clone the response so we can add custom headers to it
        let newResponse = new Response(response.body, response);
        // Set Cache-Control header for static assets

        // ✅ Allow CDN caching (Cloudflare) with per-origin separation
        setCacheHeaders(newResponse);
        setCORSHeaders(origin, newResponse);

        // Store in the cache with the new cache key (which includes the origin)
        event.waitUntil(caches.default.put(cacheKey, newResponse.clone()));
        return newResponse;
    }

    // If found in cache, apply CORS headers (needed for correct CORS behavior)
    let cachedResponse = response.clone();
    setCORSHeaders(origin, cachedResponse);
    return cachedResponse;
}

// === Proxy Other Requests ===
async function forwardRequest(event, pathWithSearch) {
    const origin = event.request.headers.get("Origin");

    let response = await fetch(`https://${API_HOST}${pathWithSearch}`, event.request);
    let newResponse = new Response(response.body, response);
    // Add CORS headers

    setCORSHeaders(origin, newResponse);
    return newResponse;
}

// === Handle Preflight (OPTIONS) ===
function handlePreflight(request) {
    const origin = request.headers.get("Origin");

    if (origin && validOrigins.includes(origin)) {
        const headers = getCORSHeaders(origin);
        return new Response(null, { status: 204, headers });
    }

    return new Response(null, {
        status: 403,
        headers: { "X-Origin": `Invalid or missing origin: "${origin}"` }
    });
}

// === Set CORS Headers ===
function setCORSHeaders(origin, response) {
    if (origin && validOrigins.includes(origin)) {
        const corsHeaders = getCORSHeaders(origin);
        for (const [key, value] of Object.entries(corsHeaders)) {
            if (key === "Vary") {
                appendVaryHeader(response, value);
            } else {
                response.headers.set(key, value);
            }
        }
    } else {
        response.headers.set("X-Origin", `Invalid or missing origin: "${origin}"`);
    }

    if (DEBUG) logHeaders("setCORSHeaders", origin, response.headers);
}

// === Get CORS Headers Object ===
function getCORSHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": CORS_HEADER_ALLOW_METHODS,
        "Access-Control-Allow-Headers": CORS_HEADER_ALLOW_HEADERS,
        "Access-Control-Allow-Credentials": CORS_HEADER_ALLOW_CREDENTIALS,
        "Vary": CORS_HEADER_VARY
    };
}

// === Set Cache Headers ===
function setCacheHeaders(response) {
    response.headers.set("Cache-Control", CACHE_HEADER_CONTROL);
    appendVaryHeader(response, CACHE_HEADER_VARY);
}

// === Append Vary Header Without Overwriting ===
function appendVaryHeader(response, value) {
    const existing = response.headers.get("Vary");
    if (!existing) {
        response.headers.set("Vary", value);
    } else {
        const values = existing.split(",").map(v => v.trim());
        if (!values.includes(value)) {
            response.headers.set("Vary", `${existing}, ${value}`);
        }
    }
}

// === Logging Helpers ===
function logResponse(source, request, response) {
    const headers = {};
    response.headers.forEach((value, key) => (headers[key] = value));

    console.log({
        source,
        method: request.method,
        origin: request.headers.get("Origin"),
        url: request.url,
        responseHeaders: headers
    });
}

function logHeaders(source, origin, headers) {
    const headersObj = {};
    headers.forEach((value, key) => (headersObj[key] = value));

    console.log({
        source,
        origin,
        validOrigins,
        headers: headersObj
    });
}

// === Event Listener ===
addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
