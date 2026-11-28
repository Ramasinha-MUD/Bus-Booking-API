// =========================================================================
// 1. API CONFIGURATION & GLOBAL STATE
// =========================================================================
// Base URL for the Bus Booking REST API
const BASE_URL = "https://api.freeprojectapi.com/api/BusBooking";

let locationNames = {}; // Maps location IDs to their readable city names
let activeBus = null;     // Stores details of the currently selected bus schedule for booking
let pickedSeats = [];     // Array holding seat numbers selected by the user

// =========================================================================
// 2. UTILITY & HELPER FUNCTIONS
// =========================================================================
// Displays a temporary success or error notification banner at the top of the page
function showStatus(msg, type = "success") {
    const el = document.getElementById("statusBox");
    el.textContent = msg;
    el.className = `status ${type}`;
    // Automatically hide the alert after 4 seconds
    setTimeout(() => el.classList.add("hidden"), 4000);
}

// Normalizes API responses into a standard JavaScript Array
function toArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
}

// Reusable wrapper around fetch() to handle GET, POST, and DELETE API requests
async function apiCall(path, method = "GET", body = null) {
    const options = {
        method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    };

    // Attach JSON payload if request body is provided
    if (body) options.body = JSON.stringify(body);

     const res = await fetch(`${BASE_URL}${path}`, options);
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch (e) {}

    // Throw an error if the HTTP response status is not 200-299
    if (!res.ok) {
        throw new Error(parsed?.message || `HTTP ${res.status}`);
    }
    return parsed;
}