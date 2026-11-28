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

// =========================================================================
// 5. SEAT MAP & SELECTION (GET /getBookedSeats)
// =========================================================================
// Opens the seat booking panel, fetches already booked seats, and renders interactive seat boxes
async function openSeats(bus) {
    activeBus = bus;
    pickedSeats = [];

    document.getElementById("bookingSection").classList.remove("hidden");
    document.getElementById("selectedBusName").textContent = `${bus.name} (${bus.fromText} ➝ ${bus.toText})`;
    document.getElementById("seatFare").textContent = bus.fare;
    updateSeatSummary();

    // Fetch already reserved seat numbers for this schedule from the API
    let booked = [];
    try {
        const res = await apiCall(`/getBookedSeats?shceduleId=${bus.id}`);
        booked = toArray(res).map(x => Number(x.seatNo || x));
    } catch (e) {}

    const grid = document.getElementById("seatsContainer");
    grid.innerHTML = "";

    // Generate seat elements from 1 to total seats
    for (let i = 1; i <= bus.seats; i++) {
        const isBooked = booked.includes(i);
        const seat = document.createElement("div");
        seat.className = `seat ${isBooked ? "booked" : ""}`;
        seat.textContent = i;

        // Allow toggling selection only if the seat is not already booked
        if (!isBooked) {
            seat.onclick = () => {
                if (pickedSeats.includes(i)) {
                    pickedSeats = pickedSeats.filter(n => n !== i);
                    seat.classList.remove("picked");
                } else {
                    pickedSeats.push(i);
                    seat.classList.add("picked");
                }
                updateSeatSummary();
            };
        }
        grid.appendChild(seat);
    }

    // Smoothly scroll down to the seat selection panel
    document.getElementById("bookingSection").scrollIntoView({ behavior: "smooth" });
}

// Updates the selected seat numbers and total ticket price calculation in the UI
function updateSeatSummary() {
    const sorted = [...pickedSeats].sort((a, b) => a - b);
    document.getElementById("pickedSeatsText").textContent = sorted.length ? sorted.join(", ") : "None";
    document.getElementById("totalFareText").textContent = sorted.length * (activeBus ? activeBus.fare : 0);
}

// =========================================================================
// 6. SUBMIT & MANAGE BOOKINGS (POST /PostBusBooking, GET & DELETE)
// =========================================================================
// Retrieve locally saved bookings from browser localStorage
let localBookings = JSON.parse(localStorage.getItem("lanka_bus_bookings") || "[]");

// Submits passenger and seat details to the API and saves a local copy
async function handleBooking(e) {
    e.preventDefault();
    if (!pickedSeats.length) {
        showStatus("Please select at least one seat!", "error");
        return;
    }

    const passengerName = document.getElementById("pName").value.trim();
    const age = Number(document.getElementById("pAge").value);
    const gender = document.getElementById("pGender").value;
    const seatsCopy = [...pickedSeats].sort((a, b) => a - b);

    // Construct request payload matching the API's expected schema
    const payload = {
        bookingId: 0,
        custId: 1,
        bookingDate: new Date().toISOString(),
        scheduleId: activeBus.id,
        BusBookingPassengers: seatsCopy.map(seatNo => ({
            passengerId: 0,
            bookingId: 0,
            passengerName: passengerName,
            age: age,
            gender: gender,
            seatNo: seatNo
        }))
    };

    let apiBookingId = Date.now();

    // Send booking request to the backend API
    try {
        const apiRes = await apiCall("/PostBusBooking", "POST", payload);
        const created = apiRes?.data || apiRes;
        if (created?.bookingId || created?.id) {
            apiBookingId = created.bookingId || created.id;
        }
        showStatus("Booking confirmed via API!");
    } catch (err) {
        showStatus("API note: " + err.message + " (Saved in My Bookings list)", "error");
    }

    // Save complete passenger & trip details in localStorage for reliable display
    const bookingRecord = {
        bookingId: apiBookingId,
        busName: activeBus.name,
        route: `${activeBus.fromText} ➝ ${activeBus.toText}`,
        date: document.getElementById("travelDate").value || new Date().toISOString().split("T")[0],
        passengerName: passengerName,
        age: age,
        gender: gender,
        seats: seatsCopy,
        totalFare: seatsCopy.length * activeBus.fare
    };

    localBookings.unshift(bookingRecord);
    localStorage.setItem("lanka_bus_bookings", JSON.stringify(localBookings));

    // Reset UI and refresh the bookings list
    document.getElementById("bookingSection").classList.add("hidden");
    document.getElementById("bookingForm").reset();
    pickedSeats = [];
    loadBookings();
}

// Fetches bookings from the API, merges them with localStorage details, and renders cards
async function loadBookings() {
    const container = document.getElementById("bookingsContainer");
    let apiList = [];

    try {
        const res = await apiCall("/GetAllBusBookings");
        apiList = toArray(res);
    } catch (err) {
        // Fallback silently to localStorage if API request fails
    }

    // Merge local records and API records using bookingId as the unique key
    const mergedMap = new Map();

    localBookings.forEach(item => {
        mergedMap.set(String(item.bookingId), item);
    });

    apiList.forEach(b => {
        const id = String(b.bookingId || b.id);
        const existing = mergedMap.get(id);
        const passengers = b.BusBookingPassengers || b.busBookingPassengers || [];
        const firstPass = passengers[0] || {};

        mergedMap.set(id, {
            bookingId: b.bookingId || b.id,
            busName: existing?.busName || b.busName || `Schedule #${b.scheduleId}`,
            route: existing?.route || "",
            date: existing?.date || (b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : "N/A"),
            passengerName: existing?.passengerName || firstPass.passengerName || b.passengerName || "Passenger",
            age: existing?.age || firstPass.age || "-",
            gender: existing?.gender || firstPass.gender || "-",
            seats: existing?.seats || passengers.map(p => p.seatNo).filter(Boolean),
            totalFare: existing?.totalFare || null
        });
    });

    const finalList = Array.from(mergedMap.values());

    if (!finalList.length) {
        container.innerHTML = `<p class="muted">No bookings found.</p>`;
        return;
    }

    // Render up to 12 most recent booking cards
    container.innerHTML = "";
    finalList.slice(0, 12).forEach(b => {
        const seatsText = b.seats && b.seats.length ? b.seats.join(", ") : "N/A";
        const fareText = b.totalFare ? `<p><strong>Total Fare:</strong> Rs. ${b.totalFare}</p>` : "";
        const routeText = b.route ? `<p><strong>Route:</strong> ${b.route}</p>` : "";

        container.innerHTML += `
            <div class="box-item">
                <h3>Booking #${b.bookingId} — ${b.passengerName}</h3>
                <p><strong>Bus:</strong> ${b.busName}</p>
                ${routeText}
                <p><strong>Age / Gender:</strong> ${b.age} yrs (${b.gender})</p>
                <p><strong>Seats:</strong> ${seatsText} | <strong>Date:</strong> ${b.date}</p>
                ${fareText}
                <button class="btn-red" onclick="deleteBooking(${b.bookingId})">Cancel Ticket</button>
            </div>
        `;
    });
}

// Cancels a booking via DELETE API endpoint and removes it from localStorage
async function deleteBooking(id) {
    if (!confirm(`Cancel Booking #${id}?`)) return;
    try {
        await apiCall(`/DeleteBusBooking?id=${id}`, "DELETE");
    } catch (err) {
        // Proceed with local removal even if API record is missing
    }

    localBookings = localBookings.filter(item => String(item.bookingId) !== String(id));
    localStorage.setItem("lanka_bus_bookings", JSON.stringify(localBookings));
    showStatus(`Booking #${id} cancelled!`);
    loadBookings();
}

// =========================================================================
// 7. EVENT LISTENERS & INITIALIZATION
// =========================================================================
// Attach click and submit event listeners to UI buttons and forms
document.getElementById("searchBtn").addEventListener("click", searchBuses);
document.getElementById("showAllBtn").addEventListener("click", loadAllBuses);
document.getElementById("bookingForm").addEventListener("submit", handleBooking);
document.getElementById("cancelPickBtn").addEventListener("click", () => document.getElementById("bookingSection").classList.add("hidden"));
document.getElementById("reloadBookingsBtn").addEventListener("click", loadBookings);

// Initialize the application once the HTML document has fully loaded
window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("travelDate").valueAsDate = new Date();
    await loadLocations(); // Populate city dropdowns
    await loadAllBuses(); // Display all available buses
    await loadBookings(); // Load existing bookings
});
