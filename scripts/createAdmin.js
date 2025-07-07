require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/childcare';

const createAdmin = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully');

        const adminData = {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            password: 'admin123', // This will be hashed by the pre-save middleware
            dob: new Date('1990-01-01'),
            relation: 'Administrator',  // Now this will be valid
            role: 'admin',
            hasCompletedRegistration: true
        };

        const existingAdmin = await User.findOne({ email: adminData.email });
        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        const admin = new User(adminData);
        await admin.save();

        console.log('Admin user created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
