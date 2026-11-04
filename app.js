const urlParams = new URLSearchParams(window.location.search);
const role = urlParams.get('view') || 'traffic';

document.getElementById('roleTitle').textContent = role === 'ambulance' ? "🚑 Ambulance Panel" : "🚦 Traffic Control Panel";

let socket;
let map;
let ambulanceMarker;
let routeLine;
let selectedIncident = null;
let ambulancePosition = [15.8700, 74.5200]; // Fixed Base
let incidentMarker = null;

const ambulanceIcon = L.divIcon({
    className: "ambulance-icon",
    html: '<div style="font-size:32px;">🚑</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

function init() {
    map = L.map("dashboardMap").setView([15.8497, 74.4977], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/*.png", {
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    // Fix tile layer URL format properly
    map.remove();
    map = L.map("dashboardMap").setView([15.8497, 74.4977], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    showAmbulanceMarker(ambulancePosition);

    if (role === 'ambulance') {
        document.getElementById('controlPanel').innerHTML = `
            <button class="btn" id="startGpsBtn">Simulate Ambulance Moving</button>
        `;
        document.getElementById('startGpsBtn').addEventListener('click', simulateAmbulanceMovement);
    }

    socket = io();

    socket.on("incident:new", (incident) => {
        selectedIncident = incident;
        renderIncident(incident);
        setIncidentMarker(incident);
        updateMapRoute();
    });

    socket.on("ambulance:location:update", (location) => {
        ambulancePosition = [location.latitude, location.longitude];
        showAmbulanceMarker(ambulancePosition);
        updateMapRoute();
    });

    loadLatestIncident();
}

async function loadLatestIncident() {
    try {
        const res = await fetch("/api/incidents");
        if (res.ok) {
            const incidents = await res.json();
            if (incidents.length > 0) {
                selectedIncident = incidents[0];
                renderIncident(selectedIncident);
                setIncidentMarker(selectedIncident);
                updateMapRoute();
            }
        }
    } catch (e) {
        console.error("Error loading incident:", e);
    }
}

function setIncidentMarker(incident) {
    const pos = [incident.latitude, incident.longitude];
    if (incidentMarker) map.removeLayer(incidentMarker);

    incidentMarker = L.marker(pos)
        .addTo(map)
        .bindPopup(`🚨 Emergency ID: ${incident.id}`)
        .openPopup();
}

function showAmbulanceMarker(position) {
    if (!ambulanceMarker) {
        ambulanceMarker = L.marker(position, { icon: ambulanceIcon })
            .addTo(map).bindPopup("🚑 Ambulance Base");
    } else {
        ambulanceMarker.setLatLng(position);
    }
}

function renderIncident(inc) {
    const list = document.getElementById("incidentList");
    list.innerHTML = `
        <div class="alert-card">
            <h4>Active Emergency ID: ${inc.id}</h4>
            <p><b>Lat/Lng:</b> ${inc.latitude.toFixed(4)}, ${inc.longitude.toFixed(4)}</p>
            ${inc.photo ? `<img src="${inc.photo}">` : ''}
        </div>
    `;
}

async function updateMapRoute() {
    if (!selectedIncident || !ambulancePosition) return;

    const start = ambulancePosition;
    const end = [selectedIncident.latitude, selectedIncident.longitude];

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(p => [p[1], p[0]]);
            
            if (routeLine) map.removeLayer(routeLine);
            
            routeLine = L.polyline(coords, { color: "blue", weight: 6 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

            const km = (data.routes[0].distance / 1000).toFixed(2);
            const mins = Math.round(data.routes[0].duration / 60);
            document.getElementById("trackingStatus").textContent = `Distance: ${km} km | ETA: ${mins} mins`;
        }
    } catch (err) {
        console.log("Routing error:", err);
    }
}

// Laptop par testing ke liye smooth simulation taaki ambulance base se victim tak chal kar aaye
function simulateAmbulanceMovement() {
    if (!selectedIncident) return alert("Pehle Victim page se SOS dabao!");

    document.getElementById("trackingStatus").textContent = "Ambulance moving towards victim...";
    
    let startLat = ambulancePosition[0];
    let startLng = ambulancePosition[1];
    let targetLat = selectedIncident.latitude;
    let targetLng = selectedIncident.longitude;

    let steps = 50;
    let currentStep = 0;

    let interval = setInterval(() => {
        currentStep++;
        let lat = startLat + (targetLat - startLat) * (currentStep / steps);
        let lng = startLng + (targetLng - startLng) * (currentStep / steps);

        ambulancePosition = [lat, lng];
        showAmbulanceMarker(ambulancePosition);
        updateMapRoute();

        socket.emit("ambulance:location", { latitude: lat, longitude: lng });

        if (currentStep >= steps) {
            clearInterval(interval);
            document.getElementById("trackingStatus").textContent = "Ambulance reached the victim!";
        }
    }, 200);
}

window.onload = init;