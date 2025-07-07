const User = require('../models/userModel');
const Child = require('../models/childModel');
const bcrypt = require('bcryptjs');

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates.password;
    delete updates.email;
    delete updates.role;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile',
      error: error.message
    });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current and new password are required'
      });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

// Add a child
exports.addChild = async (req, res) => {
  try {
    const { firstName, lastName, dob, gender } = req.body;
    
    // Validate required fields
    if (!firstName || !dob) {
      return res.status(400).json({
        success: false,
        message: 'First name and date of birth are required'
      });
    }
    
    // Create new child
    const child = new Child({
      parent: req.user.id,
      firstName,
      lastName,
      dob: new Date(dob),
      gender
    });
    
    await child.save();
    
    res.status(201).json({
      success: true,
      message: 'Child added successfully',
      child
    });
  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding child',
      error: error.message
    });
  }
};

// Get user's children
exports.getChildren = async (req, res) => {
  try {
    const children = await Child.find({ parent: req.user.id }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: children.length,
      children
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching children',
      error: error.message
    });
  }
};