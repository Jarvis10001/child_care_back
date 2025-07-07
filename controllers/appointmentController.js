const Appointment = require('../models/appointmentModel');
const User = require('../models/userModel');
const Doctor = require('../models/doctorModel');
const mongoose = require('mongoose');

// Request a new appointment (for patients)
exports.requestAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      timeSlot,
      type,
      mode,
      notes,
      reason // Also accept reason field for backward compatibility
    } = req.body;

    console.log('=== APPOINTMENT REQUEST DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Patient from token:', req.user.id);

    // Basic validation
    if (!doctorId || !appointmentDate || !timeSlot || !timeSlot.start || !timeSlot.end || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate time format (HH:MM format)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeSlot.start) || !timeRegex.test(timeSlot.end)) {
      return res.status(400).json({
        success: false,
        message: 'Time must be in HH:MM format'
      });
    }

    // Ensure start time is before end time
    if (timeSlot.start >= timeSlot.end) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    // Check if appointment date is in the future
    const appointmentDateTime = new Date(appointmentDate);
    const now = new Date();
    
    if (appointmentDateTime < now) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date must be in the future'
      });
    }

    // Validate doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Validate patient exists and get patient info
    const patient = await User.findById(req.user.id);
    if (!patient) {
      console.error('Patient not found:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    console.log('Patient found:', {
      id: patient._id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email
    });

    // Create appointment - use notes if provided, otherwise use reason
    const appointment = new Appointment({
      patient: req.user.id,
      doctor: doctorId,
      appointmentDate: new Date(appointmentDate),
      timeSlot,
      type,
      mode: mode || 'Video Call',
      notes: notes || reason, // Accept both fields
      status: 'Requested',
      activityLog: [{
        action: 'Created',
        performedBy: req.user.id,
        performerModel: 'User',
        timestamp: new Date(),
        details: `Appointment requested by patient ${patient.firstName} ${patient.lastName}`
      }]
    });
    
    await appointment.save();
    console.log('Appointment saved successfully:', appointment._id);
    
    // Populate doctor and patient details for response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctor', 'name.firstName name.lastName specialization')
      .populate('patient', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      message: 'Appointment requested successfully',
      appointment: populatedAppointment
    });
  } catch (error) {
    console.error('Error requesting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting appointment',
      error: error.message
    });
  }
};

// Get all available doctors for appointments
exports.getAvailableDoctors = async (req, res) => {
  try {
    const { specialization } = req.query;
    
    // Build query based on specialization if provided
    const query = specialization ? { specialization, isActive: true } : { isActive: true };
    
    const doctors = await Doctor.find(query)
      .select('name specialization experience qualifications availability')
      .sort({ 'name.firstName': 1 });
    
    res.status(200).json({
      success: true,
      count: doctors.length,
      doctors
    });
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available doctors',
      error: error.message
    });
  }
};

// Get patient appointments
exports.getPatientAppointments = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('Fetching appointments for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    // First check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const appointments = await Appointment.find({ patient: userId })
      .populate({
        path: 'doctor',
        select: 'name specialization contact',
        model: 'Doctor'
      })
      .sort({ appointmentDate: -1 })
      .lean();

    console.log(`Found ${appointments.length} appointments`);

    return res.status(200).json({
      success: true,
      appointments
    });

  } catch (error) {
    console.error('Error in getPatientAppointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Accept an appointment request (for doctors)
exports.acceptAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params; // Use appointmentId to match route
    
    console.log('Accepting appointment:', appointmentId, 'by doctor:', req.user.id);
    
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: req.user.id,
      status: 'Requested'
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment request not found or already processed'
      });
    }
    
    // Update appointment status
    appointment.status = 'Confirmed';
    appointment.activityLog.push({
      action: 'Confirmed',
      performedBy: req.user.id,
      performerModel: 'Doctor',
      timestamp: new Date(),
      details: 'Appointment confirmed by doctor'
    });
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment confirmed successfully',
      appointment
    });
  } catch (error) {
    console.error('Error accepting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting appointment',
      error: error.message
    });
  }
};

// Decline an appointment request (for doctors)
exports.declineAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params; // Use appointmentId to match route
    const { reason } = req.body;
    
    console.log('Declining appointment:', appointmentId, 'by doctor:', req.user.id);
    
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: req.user.id,
      status: 'Requested'
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment request not found or already processed'
      });
    }
    
    // Update appointment status
    appointment.status = 'Cancelled';
    appointment.activityLog.push({
      action: 'Cancelled',
      performedBy: req.user.id,
      performerModel: 'Doctor',
      timestamp: new Date(),
      details: reason || 'Appointment declined by doctor'
    });
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment declined successfully',
      appointment
    });
  } catch (error) {
    console.error('Error declining appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining appointment',
      error: error.message
    });
  }
};

// Get appointment requests for doctor
exports.getDoctorAppointmentRequests = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      doctor: req.user.id,
      status: 'Requested'
    })
    .populate('patient', 'firstName lastName dob email') // Make sure we're populating these fields
    .sort({ appointmentDate: 1 });
    
    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointment requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment requests',
      error: error.message
    });
  }
};

// Get pending appointments for doctor
exports.getDoctorPendingAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    console.log('=== DOCTOR PENDING APPOINTMENTS ===');
    console.log('Fetching pending appointments for doctor:', doctorId);

    const pendingAppointments = await Appointment.find({
      doctor: doctorId,
      status: 'Requested'
    })
    .populate({
      path: 'patient',
      select: 'firstName lastName email contact',
      model: 'User'
    })
    .sort({ appointmentDate: 1 });

    console.log(`Found ${pendingAppointments.length} pending appointments`);
    
    // Debug each appointment
    pendingAppointments.forEach((appointment, index) => {
      console.log(`Appointment ${index + 1}:`, {
        id: appointment._id,
        patientId: appointment.patient?._id,
        patientName: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'No patient data',
        patientEmail: appointment.patient?.email,
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        type: appointment.type,
        notes: appointment.notes
      });
    });

    return res.status(200).json({
      success: true,
      appointments: pendingAppointments
    });
  } catch (error) {
    console.error('Error fetching pending appointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending appointments',
      error: error.message
    });
  }
};

// Cancel an appointment (for patients)
exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Only the patient who made the appointment can cancel it
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: req.user.id,
      status: { $nin: ['Completed', 'Cancelled', 'No Show'] }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or cannot be cancelled'
      });
    }
    
    // Check if appointment is within 24 hours
    const appointmentDate = new Date(appointment.appointmentDate);
    const now = new Date();
    const hoursDiff = (appointmentDate - now) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) {
      return res.status(400).json({
        success: false,
        message: 'Appointments can only be cancelled at least 24 hours in advance'
      });
    }
    
    // Update appointment status
    appointment.status = 'Cancelled';
    appointment.activityLog.push({
      action: 'Cancelled',
      performedBy: req.user.id,
      performerModel: 'User',
      timestamp: new Date(),
      details: 'Appointment cancelled by patient'
    });
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment',
      error: error.message
    });
  }
};

// Generate meeting link for a confirmed appointment
exports.generateMeetingLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Verify if the appointment exists and is confirmed
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      status: 'Confirmed'
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or not confirmed'
      });
    }
    
    // Check if user is authorized (either the doctor or patient)
    if (appointment.doctor.toString() !== req.user.id && appointment.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to generate meeting link for this appointment'
      });
    }
    
    // Check if meeting is today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appointmentDate = new Date(appointment.appointmentDate);
    appointmentDate.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Only generate link on the day of the appointment
    if (appointmentDate < today || appointmentDate >= tomorrow) {
      return res.status(400).json({
        success: false,
        message: 'Meeting links can only be generated on the day of the appointment'
      });
    }
    
    // If link already exists, return it
    if (appointment.meeting && appointment.meeting.isGenerated) {
      return res.status(200).json({
        success: true,
        message: 'Meeting link already generated',
        meetingInfo: appointment.meeting
      });
    }
    
    // Generate a unique meeting link and access code using Google Meet API integration
    // For now, we'll create a mock link - in production, integrate with Google/Zoom/etc.
    const meetingId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const meetingLink = `https://meet.example.com/${meetingId}`;
    
    // Save the meeting information
    appointment.meeting = {
      link: meetingLink,
      accessCode: accessCode,
      isGenerated: true,
      generatedAt: new Date()
    };
    
    // Add to activity log
    appointment.activityLog.push({
      action: 'Meeting Link Generated',
      performedBy: req.user.id,
      performerModel: req.user.role === 'doctor' ? 'Doctor' : 'User',
      timestamp: new Date(),
      details: 'Video meeting link generated'
    });
    
    await appointment.save();
    
    // Send notification to both doctor and patient (in a production system)
    // sendNotification(appointment.doctor, 'Meeting link generated');
    // sendNotification(appointment.patient, 'Meeting link generated');
    
    res.status(200).json({
      success: true,
      message: 'Meeting link generated successfully',
      meetingInfo: appointment.meeting
    });
    
  } catch (error) {
    console.error('Error generating meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating meeting link',
      error: error.message
    });
  }
};

// Get meeting details for an appointment
exports.getAppointmentMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is authorized (either the doctor or patient)
    if (appointment.doctor.toString() !== req.user.id && appointment.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this meeting'
      });
    }
    
    // Check if meeting link exists
    if (!appointment.meeting || !appointment.meeting.isGenerated) {
      return res.status(404).json({
        success: false,
        message: 'Meeting link not generated yet'
      });
    }
    
    // Return meeting details
    res.status(200).json({
      success: true,
      meetingInfo: appointment.meeting,
      appointmentInfo: {
        date: appointment.appointmentDate,
        time: appointment.timeSlot,
        type: appointment.type,
        status: appointment.status
      }
    });
    
  } catch (error) {
    console.error('Error retrieving meeting details:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving meeting details',
      error: error.message
    });
  }
};

// Check if appointment is active today and can be joined
exports.checkAppointmentActive = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if user is authorized (either the doctor or patient)
    if (appointment.doctor.toString() !== req.user.id && appointment.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this appointment'
      });
    }
    
    // Check if appointment is confirmed
    if (appointment.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not confirmed',
        canJoin: false
      });
    }
    
    // Check if meeting is today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appointmentDate = new Date(appointment.appointmentDate);
    appointmentDate.setHours(0, 0, 0, 0);
    
    const isToday = appointmentDate.getTime() === today.getTime();
    
    // Check if it's within +/- 15 minutes of scheduled time
    let canJoin = false;
    if (isToday) {
      const now = new Date();
      const startTime = appointment.timeSlot.start.split(':');
      const appointmentTime = new Date();
      appointmentTime.setHours(parseInt(startTime[0]), parseInt(startTime[1]), 0, 0);
      
      // Calculate time difference in minutes
      const minutesDiff = Math.abs((now - appointmentTime) / (1000 * 60));
      
      // Can join if within 15 minutes before or 60 minutes after appointment start time
      canJoin = minutesDiff <= 60;
    }
    
    res.status(200).json({
      success: true,
      isToday,
      canJoin,
      hasLink: appointment.meeting?.isGenerated || false,
      appointmentInfo: {
        date: appointment.appointmentDate,
        time: appointment.timeSlot,
        type: appointment.type,
        status: appointment.status
      }
    });
    
  } catch (error) {
    console.error('Error checking appointment activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking appointment activity',
      error: error.message
    });
  }
};
