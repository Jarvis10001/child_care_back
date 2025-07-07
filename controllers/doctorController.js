const Doctor = require('../models/doctorModel');
const bcrypt = require('bcryptjs');
const Appointment = require('../models/appointmentModel');
const Patient = require('../models/userModel');
const mongoose = require('mongoose');

// Register a new doctor (admin only)
exports.registerDoctor = async (req, res) => {
    try {
        console.log('==== DOCTOR REGISTRATION ATTEMPT ====');
        console.log('Request headers:', JSON.stringify(req.headers));
        console.log('Request user:', req.user);
        console.log('Body data:', JSON.stringify(req.body, null, 2));
        
        // Check admin permissions
        if (req.user.role !== 'admin' && !req.user.isAdmin) {
            console.error('Permission denied: User is not admin', req.user);
            return res.status(403).json({
                success: false,
                message: 'Only administrators can register doctors',
                userRole: req.user.role
            });
        }
        
        console.log('Admin permissions confirmed, proceeding with registration');
        
        const {
            firstName,
            lastName,
            specialization,
            experience,
            licenseNumber,
            email,
            password,
            phone,
            address,
            availability,
            qualifications
        } = req.body;

        // Validate required fields with more explicit errors
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and last name are required'
            });
        }

        if (!specialization) {
            return res.status(400).json({
                success: false,
                message: 'Specialization is required'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }
        
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Check if doctor with this email already exists
        try {
            const existingDoctor = await Doctor.findOne({ 'contact.email': email });
            if (existingDoctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Doctor with this email already exists'
                });
            }
        } catch (emailCheckError) {
            console.error('Error checking existing email:', emailCheckError);
        }

        // Check if doctor with this license already exists (if provided)
        if (licenseNumber) {
            try {
                const existingLicense = await Doctor.findOne({ licenseNumber });
                if (existingLicense) {
                    return res.status(400).json({
                        success: false,
                        message: 'Doctor with this license number already exists'
                    });
                }
            } catch (licenseCheckError) {
                console.error('Error checking existing license:', licenseCheckError);
            }
        }

        // Create a new doctor document with required fields
        // IMPORTANT: Make sure all required fields are set to avoid null values
        const doctorData = {
            name: {
                firstName,
                lastName
            },
            specialization,
            experience: parseInt(experience) || 0,
            licenseNumber: licenseNumber || `TMP-${Date.now()}`, // Generate temporary license if not provided
            contact: {
                email, // Ensure email is provided
                phone: phone || ''
            },
            address: {
                street: address?.street || '',
                city: address?.city || '',
                state: address?.state || '',
                pincode: address?.pincode || '',
                country: address?.country || 'India'
            },
            login: {
                username: email, // Set username explicitly to match email
                password: password
            },
            qualifications: qualifications || [],
            availability: {
                daysAvailable: availability?.days || [],
                timeSlots: availability?.slots || []
            },
            isActive: true,
            role: 'doctor'
        };

        console.log('Creating new doctor with data:', JSON.stringify({
            ...doctorData,
            login: { ...doctorData.login, password: '[HIDDEN]' }
        }, null, 2));

        try {
            const doctor = new Doctor(doctorData);
            await doctor.save();
            console.log('Doctor saved successfully with id:', doctor._id);

            // Remove sensitive information before sending response
            const doctorResponse = doctor.toObject();
            delete doctorResponse.login.password;

            res.status(201).json({
                success: true,
                message: 'Doctor registered successfully',
                data: doctorResponse
            });
        } catch (saveError) {
            console.error('Error saving doctor to database:', saveError);
            
            // Handle duplicate key errors specifically
            if (saveError.code === 11000) {
                const field = Object.keys(saveError.keyPattern)[0];
                let errorMessage = `${field.replace(/\./g, ' ')} already exists`;
                
                // Special handling for login.email/username error
                if (field === 'login.email' || field === 'login.username') {
                    errorMessage = 'A doctor with this email already exists';
                }
                
                return res.status(400).json({
                    success: false,
                    message: errorMessage,
                    field: field,
                    error: 'DUPLICATE_KEY'
                });
            }
            
            return res.status(500).json({
                success: false,
                message: 'Error saving doctor to database',
                error: saveError.message
            });
        }
    } catch (error) {
        console.error('Error registering doctor:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering doctor',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find({ isActive: true })
            .select('-login.password')
            .sort({ 'name.firstName': 1 });

        res.status(200).json({
            success: true,
            count: doctors.length,
            doctors
        });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctors',
            error: error.message
        });
    }
};

// Get doctor by ID
exports.getDoctorById = async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id)
            .select('-login.password');

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        res.status(200).json({
            success: true,
            doctor
        });
    } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor',
            error: error.message
        });
    }
};

// Update doctor (admin only)
exports.updateDoctor = async (req, res) => {
    try {
        const updates = req.body;
        
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-login.password');

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Doctor updated successfully',
            doctor
        });
    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating doctor',
            error: error.message
        });
    }
};

// Delete doctor (admin only)
exports.deleteDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Doctor deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting doctor',
            error: error.message
        });
    }
};

// Get doctor's own profile
exports.getDoctorProfile = async (req, res) => {
  try {
    // Check if user is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only doctors can access this resource'
      });
    }

    const doctor = await Doctor.findById(req.user.id).select('-login.password');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.status(200).json({
      success: true,
      doctor
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update doctor's own profile
exports.updateDoctorProfile = async (req, res) => {
  try {
    // Check if user is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only doctors can update their profile'
      });
    }

    const updates = req.body;
    
    // Prevent updating sensitive fields
    delete updates.role;
    delete updates.login;
    delete updates._id;

    const doctor = await Doctor.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-login.password');
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      doctor
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all appointments for a doctor
exports.getDoctorAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate('patient', 'firstName lastName dob')
      .sort({ appointmentDate: 1 });
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get today's appointments
exports.getTodaysAppointments = async (req, res) => {
  try {
    console.log('Doctor ID in request:', req.user.id);
    console.log('Doctor role in request:', req.user.role);
    
    // Get the start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointments = await Appointment.find({ 
      doctor: req.user.id,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('patient', 'firstName lastName dob');
    
    // Add debug logging
    console.log(`Found ${appointments.length} appointments for doctor ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get upcoming appointments
exports.getUpcomingAppointments = async (req, res) => {
  try {
    // Get the start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appointments = await Appointment.find({ 
      doctor: req.user.id,
      appointmentDate: { $gt: today }
    })
    .populate('patient', 'firstName lastName dob')
    .sort({ appointmentDate: 1 });
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get past appointments
exports.getPastAppointments = async (req, res) => {
  try {
    // Get the start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appointments = await Appointment.find({ 
      doctor: req.user.id,
      appointmentDate: { $lt: today }
    })
    .populate('patient', 'firstName lastName dob')
    .sort({ appointmentDate: -1 });
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching past appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get single appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: req.user.id
    }).populate('patient', 'firstName lastName dob email contact');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all patients for a doctor
exports.getDoctorPatients = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Get unique patients from appointments
    const appointments = await Appointment.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName email dob')
      .select('patient');

    // Extract unique patients
    const patientsMap = new Map();
    appointments.forEach(apt => {
      if (apt.patient && !patientsMap.has(apt.patient._id.toString())) {
        patientsMap.set(apt.patient._id.toString(), apt.patient);
      }
    });

    const patients = Array.from(patientsMap.values());

    res.status(200).json({
      success: true,
      count: patients.length,
      patients
    });
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patients',
      error: error.message
    });
  }
};

// Get patient by ID
exports.getPatientById = async (req, res) => {
  try {
    const patient = await User.findById(req.params.id)
      .select('firstName lastName email dob relation');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      patient
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient',
      error: error.message
    });
  }
};

// Get patient history
exports.getPatientHistory = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patient: req.params.id,
      doctor: req.user.id
    })
    .populate('patient', 'firstName lastName email')
    .sort({ appointmentDate: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching patient history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient history',
      error: error.message
    });
  }
};

// Add consultation notes
exports.addConsultationNotes = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: req.user.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    appointment.notes = notes;
    appointment.activityLog.push({
      action: 'Notes Added',
      performedBy: req.user.id,
      performerModel: 'Doctor',
      timestamp: new Date(),
      details: 'Consultation notes added'
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Consultation notes added successfully',
      appointment
    });
  } catch (error) {
    console.error('Error adding consultation notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding consultation notes',
      error: error.message
    });
  }
};

// Add prescription
exports.addPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { medications, instructions } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: req.user.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    appointment.prescription = {
      medications,
      instructions,
      issuedAt: new Date()
    };

    appointment.activityLog.push({
      action: 'Prescription Added',
      performedBy: req.user.id,
      performerModel: 'Doctor',
      timestamp: new Date(),
      details: 'Prescription added to appointment'
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Prescription added successfully',
      appointment
    });
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding prescription',
      error: error.message
    });
  }
};

// Get doctor statistics
exports.getDoctorStats = async (req, res) => {
    try {
        const doctorId = req.user.id;
        
        // Get various appointment counts
        const totalAppointments = await Appointment.countDocuments({ doctor: doctorId });
        const completedAppointments = await Appointment.countDocuments({ 
            doctor: doctorId, 
            status: 'Completed' 
        });
        const upcomingAppointments = await Appointment.countDocuments({ 
            doctor: doctorId, 
            appointmentDate: { $gt: new Date() },
            status: { $in: ['Confirmed', 'Scheduled'] }
        });
        const pendingRequests = await Appointment.countDocuments({ 
            doctor: doctorId, 
            status: 'Requested' 
        });

        // Get today's appointments
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAppointments = await Appointment.countDocuments({
            doctor: doctorId,
            appointmentDate: {
                $gte: today,
                $lt: tomorrow
            }
        });

        res.status(200).json({
            success: true,
            stats: {
                totalAppointments,
                completedAppointments,
                upcomingAppointments,
                pendingRequests,
                todayAppointments
            }
        });
    } catch (error) {
        console.error('Error fetching doctor stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor statistics',
            error: error.message
        });
    }
};

// Get today's appointments - fix the method name
exports.getTodayAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointments = await Appointment.find({
            doctor: doctorId,
            appointmentDate: {
                $gte: today,
                $lt: tomorrow
            }
        })
        .populate('patient', 'firstName lastName email')
        .sort({ 'timeSlot.start': 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Error fetching today appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching today\'s appointments',
            error: error.message
        });
    }
};

// Get upcoming appointments
exports.getUpcomingAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { date } = req.query;
        
        let query = {
            doctor: doctorId,
            appointmentDate: { $gt: new Date() }
        };

        // If specific date is requested
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            
            query.appointmentDate = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const appointments = await Appointment.find(query)
            .populate('patient', 'firstName lastName email')
            .sort({ appointmentDate: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Error fetching upcoming appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching upcoming appointments',
            error: error.message
        });
    }
};

// Get appointment history
exports.getAppointmentHistory = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { date } = req.query;
        
        let query = {
            doctor: doctorId,
            appointmentDate: { $lt: new Date() }
        };

        // If specific date is requested
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            
            query.appointmentDate = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const appointments = await Appointment.find(query)
            .populate('patient', 'firstName lastName email')
            .sort({ appointmentDate: -1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Error fetching appointment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointment history',
            error: error.message
        });
    }
};
