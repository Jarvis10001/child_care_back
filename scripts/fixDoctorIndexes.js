/**
 * This script fixes the indexes in the doctors collection
 * Run this script with: node scripts/fixDoctorIndexes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function fixDoctorIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get the doctors collection
    const db = mongoose.connection.db;
    const doctorsCollection = db.collection('doctors');
    
    // Step 1: List all indexes to see what exists
    console.log('Current indexes:');
    const indexes = await doctorsCollection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // Step 2: Drop the problematic login.email index
    try {
      console.log('Dropping login.email index...');
      await doctorsCollection.dropIndex('login.email_1');
      console.log('Successfully dropped login.email index');
    } catch(error) {
      console.log('No login.email index to drop or error dropping index:', error.message);
    }
    
    // Step 3: Ensure all doctors have login.username set to their email
    console.log('Updating doctors without login.username...');
    const result = await doctorsCollection.updateMany(
      { 'login.username': { $exists: false } },
      [
        {
          $set: {
            'login.username': '$contact.email'
          }
        }
      ]
    );
    console.log(`Updated ${result.modifiedCount} doctors`);
    
    // Step 4: Create the correct indexes
    console.log('Creating proper indexes...');
    await doctorsCollection.createIndex({ 'name.firstName': 1, 'name.lastName': 1 });
    await doctorsCollection.createIndex({ 'specialization': 1 });
    await doctorsCollection.createIndex({ 'address.city': 1, 'address.state': 1 });
    await doctorsCollection.createIndex({ 'contact.email': 1 }, { unique: true });
    await doctorsCollection.createIndex({ 'licenseNumber': 1 }, { unique: true });
    
    console.log('Final indexes:');
    const updatedIndexes = await doctorsCollection.indexes();
    console.log(JSON.stringify(updatedIndexes, null, 2));
    
    console.log('Doctor collection indexes fixed successfully');
  } catch (error) {
    console.error('Error fixing doctor indexes:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
fixDoctorIndexes();
