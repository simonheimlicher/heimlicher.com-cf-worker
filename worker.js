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
    // Clone the response so we can modify headers
    let tmpResponse = new Response(response.body, response);
    
    // Now we can safely add CORS headers
    finalResponse = addCORSHeaders(event, tmpResponse);
    return finalResponse;
}

// Add CORS headers with dynamic origin check
function addCORSHeaders(event, response) {
    const origin = event.request.headers.get('Origin');

    // Clone the response so we can modify headers
    let tmpResponse = new Response(response.body, response);

    // Return origin as header for debugging
    tmpResponse.headers.set('X-Origin', `Checking if origin '${origin}' is in ${validOrigins.join(', ')}`);

    // Check if the origin is valid, and set CORS headers accordingly
    if (origin && validOrigins.includes(origin)) {
        tmpResponse.headers.set('Access-Control-Allow-Origin', origin); // Allow specific origin
        tmpResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        tmpResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        tmpResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    }
 
    // Convert headers to an object for easier logging
    const headersObj = {};
    tmpResponse.headers.forEach((value, key) => {
        headersObj[key] = value;
    });

    // Log origin, validOrigins, and the formatted response headers
    console.log({
        origin: origin,
        validOrigins: validOrigins,
        responseHeaders: headersObj
    });

    return tmpResponse;
}

addEventListener("fetch", (event) => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
});
