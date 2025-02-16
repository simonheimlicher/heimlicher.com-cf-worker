const API_HOST = "eu.posthog.com"; // Change to "eu.posthog.com" for the EU region

const validOrigins = [
    "https://stage.heimlicher.com",
    "https://simon.heimlicher.com",
    "https://heimlicher.com"
];

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
    const request = new Request(event.request);
    // Do not delete cookies, pass them along
    let response = await fetch(`https://${API_HOST}${pathWithSearch}`, request);
    
    // Clone the response and add CORS headers
    let newResponse = new Response(response.body, response);
    addCORSHeaders(event, newResponse);
    
    return newResponse;
}

// Function to add CORS headers with dynamic origin check
function addCORSHeaders(event, response) {
    const origin = event.request.headers.get('Origin');
    
    // Only allow CORS if the origin is valid
    if (validOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);  // Allow specific origin
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
        // In case of invalid origin, we can block the request by not adding the CORS headers
        response.headers.set('Access-Control-Allow-Origin', origin);  // Show invalid origin
    }
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
