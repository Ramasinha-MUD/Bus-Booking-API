// =========================================================================
// 1. API CONFIGURATION & GLOBAL STATE
// =========================================================================
// Base URL for the Bus Booking REST API
const BASE_URL = "https://api.freeprojectapi.com/api/BusBooking";

let locationNames = {}; // Maps location IDs to their readable city names
let activeBus = null;     // Stores details of the currently selected bus schedule for booking
let pickedSeats = [];     // Array holding seat numbers selected by the user
