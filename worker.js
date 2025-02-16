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
    
    if (pathname.startsWith("/static/")) {
        return retrieveStatic(event, pathWithSearch);
    } else {
        return forwardRequest(event, pathWithSearch);
    }
}

async function retrieveStatic(event, pathWithSearch) {
    let response = await caches.default.match(event.request);
    
    if (!response) {
        response = await fetch(`https://${API_HOST}${pathWithSearch}`);
        // Clone the response so we can add custom headers to it
        let newResponse = new Response(response.body, response);
        // Set Cache-Control header for static assets
        newResponse.headers.set('Cache-Control', 'public, max-age=2592000'); // 30 days
        
        // CORS headers with dynamic origin check
        addCORSHeaders(event, newResponse);
        
        event.waitUntil(caches.default.put(event.request, newResponse.clone()));
        return newResponse;
    }
    return response;
}

async function forwardRequest(event, pathWithSearch) {
    let response = await fetch(`https://${API_HOST}${pathWithSearch}`, event.request);
    addCORSHeaders(event, response);
    return response;
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
        // If origin is invalid, you could log it for debugging
        response.headers.set('X-Access-Control-Check-Origin', `Invalid or missing origin: '${origin}'`);
        // Optionally, you could return a 403 or another status code here
    }
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
