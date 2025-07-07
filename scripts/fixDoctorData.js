/**
 * This script fixes the login.username issue in the doctors collection
 * Run this script to update all existing doctor records
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Doctor = require('../models/doctorModel');

async function fixDoctorData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find all doctors
    const doctors = await Doctor.find({});
    console.log(`Found ${doctors.length} doctors`);
    
    // Update each doctor to ensure login.username is set
    for (const doctor of doctors) {
      if (doctor.contact && doctor.contact.email) {
        if (!doctor.login) {
          doctor.login = {};
        }
        
        // Set login.username to email if it's missing or null
        if (!doctor.login.username) {
          doctor.login.username = doctor.contact.email;
          console.log(`Setting login.username for doctor ${doctor._id} to ${doctor.contact.email}`);
          await doctor.save();
        }
      } else {
        console.warn(`Doctor ${doctor._id} has no email. Cannot set login.username`);
      }
    }
    
    console.log('Doctor data update completed');
    
  } catch (error) {
    console.error('Error fixing doctor data:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
fixDoctorData();
