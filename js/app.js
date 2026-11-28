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

// =========================================================================
// 3. LOAD LOCATIONS (GET /GetBusLocations)
// =========================================================================
// Fetches all available bus locations and populates the "From" and "To" dropdown menus
async function loadLocations() {
    try {
        const res = await apiCall("/GetBusLocations");
        const list = toArray(res);

        const fromSelect = document.getElementById("fromLoc");
        const toSelect = document.getElementById("toLoc");
        fromSelect.innerHTML = `<option value="">From Location</option>`;
        toSelect.innerHTML = `<option value="">To Location</option>`;
        locationNames = {};

        // Loop through locations, store ID-to-Name mapping, and create <option> elements
        list.forEach(item => {
            const id = item.locationId || item.id;
            const name = item.locationName || item.name;
            if (!id || !name) return;

            locationNames[id] = name;
            fromSelect.innerHTML += `<option value="${id}">${name}</option>`;
            toSelect.innerHTML += `<option value="${id}">${name}</option>`;
        });
    } catch (err) {
        showStatus("Locations load error: " + err.message, "error");
    }
}

// =========================================================================
// 4. LOAD & SEARCH BUS SCHEDULES (GET /GetBusSchedules)
// =========================================================================
// Fetches and displays all available bus schedules without filtering
async function loadAllBuses() {
    try {
        const res = await apiCall("/GetBusSchedules");
        renderBuses(toArray(res));
    } catch (err) {
        showStatus("Buses load error: " + err.message, "error");
    }
}

// Filters bus schedules based on the selected "From" and "To" city names
async function searchBuses() {
    const fromId = document.getElementById("fromLoc").value;
    const toId = document.getElementById("toLoc").value;

    const selectedFromName = (locationNames[fromId] || "").trim().toLowerCase();
    const selectedToName = (locationNames[toId] || "").trim().toLowerCase();

    // If neither location is selected, show all schedules
    if (!selectedFromName && !selectedToName) {
        return loadAllBuses();
    }

    try {
        const allRes = await apiCall("/GetBusSchedules");
        let buses = toArray(allRes);

        // Filter schedules matching the chosen departure and arrival cities
        buses = buses.filter(bus => {
            const busFromName = (
                bus.fromLocationName ||
                bus.fromCity ||
                locationNames[bus.fromLocation] ||
                ""
            ).trim().toLowerCase();

            const busToName = (
                bus.toLocationName ||
                bus.toCity ||
                locationNames[bus.toLocation] ||
                ""
            ).trim().toLowerCase();

            const matchFrom = !selectedFromName || busFromName === selectedFromName;
            const matchTo = !selectedToName || busToName === selectedToName;

            return matchFrom && matchTo;
        });

        renderBuses(buses);
    } catch (err) {
        showStatus("Search error: " + err.message, "error");
    }
}

// Renders bus schedule cards into the DOM
function renderBuses(buses) {
    const container = document.getElementById("busResults");
    if (!buses.length) {
        container.innerHTML = `<p class="muted">No buses found for this route.</p>`;
        return;
    }

    container.innerHTML = "";
    buses.forEach(bus => {
        const id = bus.scheduleId || bus.id;
        const fromText = bus.fromLocationName || bus.fromCity || locationNames[bus.fromLocation] || `Location ${bus.fromLocation}`;
        const toText = bus.toLocationName || bus.toCity || locationNames[bus.toLocation] || `Location ${bus.toLocation}`;
        const fare = bus.price || 500;
        const seats = bus.totalSeats || 32;

        // Serialize bus data to pass into the openSeats() click handler
        const busData = JSON.stringify({
            id,
            name: bus.busName || "Express Bus",
            fromText,
            toText,
            fare,
            seats
        });

        container.innerHTML += `
            <div class="box-item">
                <h3>${bus.busName || "Express Bus"} (${bus.busVehicleNo || "N/A"})</h3>
                <p><strong>Route:</strong> ${fromText} ➝ ${toText}</p>
                <p><strong>Fare:</strong> Rs. ${fare} | <strong>Seats:</strong> ${seats}</p>
                <button class="btn-blue" onclick='openSeats(${busData})'>Select Seats</button>
            </div>
        `;
    });
}