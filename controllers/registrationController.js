const cloudinary = require('../config/cloudinaryConfig');
const RegistrationForm = require('../models/registrationFormModel');
const User = require('../models/userModel');
const fs = require('fs');
const path = require('path');

exports.getRegistrationForm = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if registration is complete
        const registrationComplete = user.hasCompletedRegistration ? 1 : 0;
        
        // Get pre-fill data from user's profile
        const preFillData = {
            personalInfo: {
                applicantName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                mobileNumber: user.mobileNumber || '',
                email: user.email || '',
                dob: user.dob || '',
                gender: user.gender || '',
                relation: user.relation || ''
            }
        };
        
        res.status(200).json({
            success: true,
            registrationComplete,
            registrationForm: user.registrationData || null,
            preFillData: user.hasCompletedRegistration ? null : preFillData
        });
    } catch (error) {
        console.error('Error fetching registration form:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching registration form',
            error: error.message
        });
    }
};

exports.updateRegistrationForm = async (req, res) => {
    try {
        // Prepare update data from form fields
        let updateData = {
            personalInfo: {
                applicantName: req.body.applicantName,
                mobileNumber: req.body.mobileNumber,
                dateOfBirth: req.body.dateOfBirth,
                email: req.body.email,
                gender: req.body.gender,
                relationWithApplicant: req.body.relationWithApplicant
            },
            address: {
                fullAddress: req.body.fullAddress,
                state: req.body.state,
                city: req.body.city,
                village: req.body.village,
                pincode: req.body.pincode
            },
            identityProof: {
                hasBirthCertificate: req.body.hasBirthCertificate === 'yes',
                idType: req.body.idType
            }
        };

        // Handle file upload if new file is provided
        if (req.file) {
            const cloudinaryResponse = await cloudinary.uploader.upload(
                `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
                {
                    folder: 'identity_proofs',
                    resource_type: 'auto',
                    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
                }
            );

            updateData.identityProof.idProofFile = {
                fileName: req.file.originalname,
                fileUrl: cloudinaryResponse.secure_url,
                uploadedAt: new Date()
            };
        }

        // Find and update the form
        const registrationForm = await RegistrationForm.findOneAndUpdate(
            { userId: req.user.id },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!registrationForm) {
            return res.status(404).json({
                success: false,
                message: 'Registration form not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Registration form updated successfully',
            registrationForm
        });

    } catch (error) {
        console.error('Error updating registration form:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating registration form',
            error: error.message
        });
    }
};

exports.completeRegistration = async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    const userId = req.user.id;
    
    // Validate the request body
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing'
      });
    }

    // Destructure with validation
    const {
      firstName,
      lastName,
      gender,
      phone,
      dob,
      relation,
      address,
      city,
      state,
      zipCode,
      identityProof
    } = req.body;

    // Validate required fields
    const requiredFields = { firstName, lastName, gender, phone, dob };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    try {
      // Generate reference ID
      const year = new Date().getFullYear();
      const count = await RegistrationForm.countDocuments();
      const referenceId = `REG-${year}-${(count + 1).toString().padStart(4, '0')}`;

      // Create registration form with reference ID
      const registrationData = {
        userId,
        referenceId,
        personalInfo: {
          applicantName: `${firstName} ${lastName}`.trim(),
          mobileNumber: phone,
          dob: new Date(dob),
          email: user.email,
          gender,
          relation
        },
        address: {
          address: address || '',
          city: city || '',
          state: state || '',
          pincode: zipCode || ''
        },
        identityProof: {
          type: identityProof?.type || 'other',
          hasBirthCertificate: Boolean(identityProof?.hasBirthCertificate)
        }
      };

      const registrationForm = await RegistrationForm.create(registrationData);

      // Update user profile
      const updates = {
        firstName,
        lastName,
        gender,
        phone,
        dob,
        hasCompletedRegistration: true,
        registrationCompletedAt: new Date()
      };

      Object.assign(user, updates);
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Registration completed successfully',
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          hasCompletedRegistration: true,
          registrationCompletedAt: user.registrationCompletedAt
        }
      });

    } catch (saveError) {
      console.error('Error saving data:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Error saving registration data',
        error: saveError.message
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error completing registration',
      error: error.message || 'Internal server error'
    });
  }
};

// Enhance the getRegistrationStatus function to be more detailed and consistent
exports.getRegistrationStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('hasCompletedRegistration registrationCompletedAt firstName lastName email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Make sure hasCompletedRegistration is explicitly boolean for consistent checking
    const hasCompleted = user.hasCompletedRegistration === true;
    
    console.log(`Registration status for user ${userId}: ${hasCompleted}`);
    
    return res.status(200).json({
      success: true,
      hasCompletedRegistration: hasCompleted,
      registrationCompletedAt: user.registrationCompletedAt || null,
      userData: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error checking registration status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking registration status',
      error: error.message
    });
  }
};
