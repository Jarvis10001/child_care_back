// backend/routes/calendarRoutes.js
const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendarController");

// Route to schedule a meeting (for patients)
router.post("/schedule", calendarController.scheduleMeeting);

// Route to fetch calendar events
router.get("/events", calendarController.getEvents);

module.exports = router;
