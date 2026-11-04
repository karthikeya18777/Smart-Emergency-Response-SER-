const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

let currentIncident = null; 

// Ambulance ka Base Station (Hospital) coordinates
const baseAmbulanceLocation = {
    latitude: 15.8700, 
    longitude: 74.5200
};

let currentAmbulanceLocation = { ...baseAmbulanceLocation, updatedAt: new Date() };

app.get("/api/incidents", (req, res) => {
    res.json(currentIncident ? [currentIncident] : []);
});

app.post("/api/incidents", (req, res) => {
    // 1. Naya emergency save karo
    currentIncident = {
        id: Date.now(),
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        photo: req.body.photo || null,
        status: "Pending"
    };

    // 2. Jaise hi naya SOS aaye, ambulance ko wapas base par reset kar do!
    currentAmbulanceLocation = { ...baseAmbulanceLocation, updatedAt: new Date() };

    // 3. Sabhi ko broadcast karo
    io.emit("incident:new", currentIncident);
    io.emit("ambulance:location:update", currentAmbulanceLocation);
    
    res.json(currentIncident);
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.emit("ambulance:location:update", currentAmbulanceLocation);
    if (currentIncident) {
        socket.emit("incident:new", currentIncident);
    }

    socket.on("ambulance:location", (data) => {
        if (data && data.latitude && data.longitude) {
            currentAmbulanceLocation = {
                latitude: data.latitude,
                longitude: data.longitude,
                updatedAt: new Date()
            };
            io.emit("ambulance:location:update", currentAmbulanceLocation);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});