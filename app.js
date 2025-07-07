import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';

const Appointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('today');
    const [declineReason, setDeclineReason] = useState('');
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [activeAppointments, setActiveAppointments] = useState({});
    const [filterDate, setFilterDate] = useState('');
    const [generatingLink, setGeneratingLink] = useState({});
    const [meetingLinks, setMeetingLinks] = useState({});

    const navigate = useNavigate();
    const location = useLocation();

    // Get the token from localStorage
    const token = localStorage.getItem('token');

    // Determine which tab is active based on route
    useEffect(() => {
        if (location.pathname.includes('/today')) {
            setActiveTab('today');
        } else if (location.pathname.includes('/upcoming')) {
            setActiveTab('upcoming');
        } else if (location.pathname.includes('/history')) {
            setActiveTab('past');
        } else if (location.pathname === '/doctor/appointments') {
            setActiveTab('requests');
            fetchPendingRequests();
        }
    }, [location.pathname]);

    // Fetch pending appointment requests
    useEffect(() => {
        if (activeTab === 'requests') {
            fetchPendingRequests();
        }
    }, [activeTab]);

    // Fetch appointments based on active tab
    useEffect(() => {
        if (activeTab !== 'requests') {
            fetchAppointments();
        }
    }, [activeTab, filterDate]);

    const fetchPendingRequests = async () => {
        setRequestsLoading(true);
        try {
            const response = await axios.get(
                'http://localhost:2006/api/appointments/doctor/pending',
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setPendingRequests(response.data.appointments);
            }
        } catch (error) {
            console.error('Error fetching pending requests:', error);
            toast.error('Failed to load pending requests');
        } finally {
            setRequestsLoading(false);
        }
    };

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            let endpoint;
            switch (activeTab) {
                case 'today':
                    endpoint = 'http://localhost:2006/api/doctors/appointments/today';
                    break;
                case 'upcoming':
                    endpoint = 'http://localhost:2006/api/doctors/appointments/upcoming';
                    break;
                case 'past':
                    endpoint = 'http://localhost:2006/api/doctors/appointments/history';
                    break;
                default:
                    endpoint = 'http://localhost:2006/api/doctors/appointments';
            }

            // Add date filter if selected
            if (filterDate && (activeTab === 'upcoming' || activeTab === 'past')) {
                endpoint += `?date=${filterDate}`;
            }

            console.log('Fetching appointments from endpoint:', endpoint); // Debug log

            const response = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const appts = response.data.appointments;
                console.log('Received appointments:', appts); // Debug log

                // Validate received data
                const validatedAppointments = appts.map(appointment => {
                    if (!appointment.patient || typeof appointment.patient !== 'object') {
                        console.warn('Invalid patient data found:', appointment);
                        // Create a placeholder patient object
                        appointment.patient = {
                            firstName: 'Unknown',
                            lastName: '',
                            _id: 'missing'
                        };
                    }
                    return appointment;
                });

                setAppointments(validatedAppointments);

                // Check which appointments are active for today's appointments
                if (activeTab === 'today') {
                    for (const appt of validatedAppointments) {
                        checkAppointmentActive(appt._id);
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching ${activeTab} appointments:`, error);
            toast.error(`Failed to load ${activeTab} appointments`);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptRequest = async (appointmentId) => {
        try {
            const response = await axios.put(
                `http://localhost:2006/api/appointments/accept/${appointmentId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                toast.success('Appointment request accepted');
                // Update the requests list
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error accepting appointment:', error);
            toast.error('Failed to accept appointment request');
        }
    };

    const openDeclineModal = (appointmentId) => {
        setSelectedRequestId(appointmentId);
        setShowDeclineModal(true);
    };

    const handleDeclineRequest = async () => {
        try {
            const response = await axios.put(
                `http://localhost:2006/api/appointments/decline/${selectedRequestId}`,
                { reason: declineReason },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                toast.success('Appointment request declined');
                // Close modal and reset
                setShowDeclineModal(false);
                setDeclineReason('');
                setSelectedRequestId(null);
                // Update the requests list
                fetchPendingRequests();
            }
        } catch (error) {
            console.error('Error declining appointment:', error);
            toast.error('Failed to decline appointment request');
        }
    };

    // Format appointment date
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    // Get status badge color
    const getStatusColor = (status) => {
        const statusColors = {
            'Requested': 'bg-yellow-100 text-yellow-800',
            'Scheduled': 'bg-blue-100 text-blue-800',
            'Confirmed': 'bg-green-100 text-green-800',
            'Completed': 'bg-purple-100 text-purple-800',
            'Cancelled': 'bg-red-100 text-red-800',
            'No Show': 'bg-gray-100 text-gray-800'
        };
        return statusColors[status] || 'bg-gray-100 text-gray-800';
    };

    // Check if an appointment is active (can be joined) today
    const checkAppointmentActive = async (appointmentId) => {
        try {
            const response = await axios.get(
                `http://localhost:2006/api/meetings/${appointmentId}/check`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
                setActiveAppointments(prev => ({
                    ...prev,
                    [appointmentId]: response.data
                }));

                return response.data;
            }
        } catch (error) {
            console.error('Error checking appointment status:', error);
            return { canJoin: false, hasLink: false };
        }
    };

    // Generate meeting link for an appointment using Google Meet
    const generateMeetingLink = async (appointmentId) => {
        try {
            const response = await axios.post(
                `http://localhost:2006/api/meetings/${appointmentId}/generate`,
                {},
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
                toast.success('Meeting link generated successfully');

                // Update active appointments state
                checkAppointmentActive(appointmentId);

                return response.data.meetingInfo;
            }
        } catch (error) {
            console.error('Error generating meeting link:', error);
            toast.error(error.response?.data?.message || 'Failed to generate meeting link');
            return null;
        }
    };

    // Join a meeting with proper error handling and feedback
    const joinMeeting = async (appointmentId) => {
        try {
            setLoading(true);
            toast.loading('Preparing meeting...', { id: 'meeting-loading' });

            // First check if appointment is active
            const status = await axios.get(
                `http://localhost:2006/api/meetings/${appointmentId}/check`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!status.data.success || !status.data.canJoin) {
                toast.error('This appointment cannot be joined at this time', { id: 'meeting-loading' });
                setLoading(false);
                return;
            }

            let meetingInfo;

            // If link already exists, get it
            if (status.data.hasLink) {
                const response = await axios.get(
                    `http://localhost:2006/api/meetings/${appointmentId}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (response.data.success) {
                    meetingInfo = response.data.meetingInfo;
                    // Join the meeting
                    await axios.post(`http://localhost:2006/api/meetings/${appointmentId}/join`, {}, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    toast.success('Meeting ready! Opening Google Meet...', { id: 'meeting-loading' });

                    // Open the Google Meet link in a new tab
                    window.open(meetingInfo.link, '_blank');

                    // Update the meeting status in our state
                    setActiveAppointments(prev => ({
                        ...prev,
                        [appointmentId]: {
                            ...prev[appointmentId],
                            lastJoined: new Date()
                        }
                    }));
                }
            } else {
                // Generate new link with Google Meet
                const response = await axios.post(
                    `http://localhost:2006/api/meetings/${appointmentId}/generate`,
                    {},
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (response.data.success) {
                    meetingInfo = response.data.meetingInfo;
                    // Join the meeting
                    await axios.post(`http://localhost:2006/api/meetings/${appointmentId}/join`, {}, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    toast.success('Meeting created! Opening Google Meet...', { id: 'meeting-loading' });

                    // Open the Google Meet link in a new tab
                    window.open(meetingInfo.link, '_blank');

                    // Update our state
                    setActiveAppointments(prev => ({
                        ...prev,
                        [appointmentId]: {
                            ...prev[appointmentId],
                            hasLink: true,
                            lastJoined: new Date()
                        }
                    }));
                }
            }

            if (!meetingInfo) {
                toast.error('Failed to retrieve meeting link', { id: 'meeting-loading' });
            }

        } catch (error) {
            console.error('Error joining meeting:', error);
            toast.error('Failed to join meeting', { id: 'meeting-loading' });
        } finally {
            setLoading(false);
        }
    };

    // Add this test function with improved error handling and mock support
    const testMeetingLink = async (appointmentId) => {
        try {
            setLoading(true);
            toast.loading('Testing meeting link...', { id: 'test-meeting' });

            console.log(`Testing meeting link for appointment: ${appointmentId}`);

            // Force generate meeting link
            const response = await axios.post(
                `http://localhost:2006/api/meetings/${appointmentId}/generate`,
                { isTest: true }, // Add in body as well as query param
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { test: true }
                }
            );

            if (response.data.success) {
                const meetingInfo = response.data.meetingInfo;

                toast.success('Meeting link generated & ready to test!', { id: 'test-meeting' });
                console.log("Meeting info received:", meetingInfo);

                // Open the Google Meet link in a new tab
                if (meetingInfo?.link) {
                    window.open(meetingInfo.link, '_blank');
                } else {
                    toast.warning('Meeting link created but URL is missing', { id: 'test-meeting' });
                }

                // Update our state
                setActiveAppointments(prev => ({
                    ...prev,
                    [appointmentId]: {
                        ...prev[appointmentId],
                        hasLink: true,
                        lastTested: new Date()
                    }
                }));

                // Refresh meeting status
                await checkAppointmentActive(appointmentId);
            } else {
                toast.error('Failed to generate test link', { id: 'test-meeting' });
            }
        } catch (error) {
            console.error('Error testing meeting link:', error);

            // More detailed error logging
            if (error.response) {
                // The request was made and the server responded with a status code
                console.error(`Server responded with status: ${error.response.status}`);
                console.error('Response data:', error.response.data);
                console.error('Response headers:', error.response.headers);

                // Display the specific error from the server response
                toast.error(
                    `Failed to test meeting link: ${error.response.data.error || error.response.data.message || error.message}`,
                    { id: 'test-meeting' }
                );
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response received:', error.request);
                toast.error('Server did not respond to the request', { id: 'test-meeting' });
            } else {
                // Something else caused the error
                console.error('Error message:', error.message);
                toast.error(`Error: ${error.message}`, { id: 'test-meeting' });
            }
        } finally {
            setLoading(false);
        }
    };

    const renderAppointmentsList = () => {
        if (loading) {
            return (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4CAF50]"></div>
                </div>
            );
        }

        if (appointments.length === 0) {
            return (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4CAF50]/10 mb-4">
                        <i className="ri-calendar-line text-[#4CAF50] text-3xl"></i>
                    </div>
                    <h2 className="text-xl font-semibold text-[#333333] mb-2">No appointments found</h2>
                    <p className="text-[#6C757D] mb-6">
                        You don't have any {activeTab === 'today' ? 'appointments scheduled for today' :
                            activeTab === 'upcoming' ? 'upcoming appointments' : 'past appointments'}
                    </p>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Patient</th>
                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Date & Time</th>
                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Type</th>
                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {appointments.map((appointment, index) => (
                                <motion.tr
                                    key={appointment._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-gray-50 transition-colors duration-300"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                                                <i className="ri-user-line text-[#4CAF50]"></i>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {appointment.patient && typeof appointment.patient === 'object' ?
                                                        `${appointment.patient.firstName || 'Unknown'} ${appointment.patient.lastName || ''}` :
                                                        'Patient data unavailable'}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    ID: #{appointment.patient?._id ?
                                                        appointment.patient._id.substring(0, 6) :
                                                        'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                                        {formatDate(appointment.appointmentDate)}<br />
                                        <span className="text-sm text-gray-500">
                                            {appointment.timeSlot?.start || '--'} - {appointment.timeSlot?.end || '--'}
                                            {appointment.timeSlot?.isCustom && " (Custom)"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                                        {appointment.type || 'N/A'}
                                        <br />
                                        <span className="text-sm text-gray-500">
                                            {appointment.mode || 'Not specified'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(appointment.status)}`}>
                                            {appointment.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {renderAppointmentActions(appointment)}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderPendingRequests = () => {
        if (requestsLoading) {
            return (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4CAF50]"></div>
                </div>
            );
        }

        if (pendingRequests.length === 0) {
            return (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4CAF50]/10 mb-4">
                        <i className="ri-calendar-check-line text-[#4CAF50] text-3xl"></i>
                    </div>
                    <h2 className="text-xl font-semibold text-[#333333] mb-2">No pending requests</h2>
                    <p className="text-[#6C757D] mb-4">You don't have any appointment requests pending approval</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {pendingRequests.map((request, index) => (
                    <motion.div
                        key={request._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-yellow-400"
                    >
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                            <div>
                                <h3 className="font-semibold text-lg text-gray-800">
                                    {request.patient?.firstName || 'Unknown'} {request.patient?.lastName || ''}
                                </h3>
                                <p className="text-gray-500">
                                    {formatDate(request.appointmentDate)} • {request.timeSlot?.start || '--'} - {request.timeSlot?.end || '--'}
                                    {request.timeSlot?.isCustom && " (Custom time)"}
                                </p>
                                <p className="mt-2">
                                    <span className="font-medium">Reason:</span> {request.notes || 'No reason provided'}
                                </p>
                            </div>
                            <div className="flex space-x-3 mt-4 md:mt-0">
                                <button
                                    onClick={() => handleAcceptRequest(request._id)}
                                    className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg hover:bg-[#45a049] transition-colors"
                                >
                                    Accept
                                </button>
                                <button
                                    onClick={() => openDeclineModal(request._id)}
                                    className="px-4 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    // Enhanced Google Meet link generation - production version
    const generateGoogleMeetLink = async (appointmentId) => {
        setGeneratingLink(prev => ({ ...prev, [appointmentId]: true }));

        try {
            toast.loading('Generating Google Meet link...', { id: 'generate-meet' });

            // Generate the meeting link
            const response = await axios.post(
                `http://localhost:2006/api/meetings/${appointmentId}/generate`,
                {},
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
                const meetingInfo = response.data.meetingInfo;

                // Update state with meeting info
                setMeetingLinks(prev => ({
                    ...prev,
                    [appointmentId]: meetingInfo
                }));

                toast.success('Google Meet link generated successfully!', { id: 'generate-meet' });

                // Send notification to patient
                await notifyPatientAboutMeeting(appointmentId, meetingInfo);

                // Refresh appointments to show updated status
                fetchAppointments();
            }
        } catch (error) {
            console.error('Error generating Google Meet link:', error);

            if (error.response?.status === 401 && error.response?.data?.requiresAuth) {
                // Need Google authorization
                toast.error('Please authorize Google Calendar access first', { id: 'generate-meet' });

                try {
                    const authUrlResponse = await axios.get(
                        'http://localhost:2006/api/meetings/google/auth',
                        {
                            headers: { 'Authorization': `Bearer ${token}` },
                            params: { appointmentId }
                        }
                    );

                    if (authUrlResponse.data.success && authUrlResponse.data.authUrl) {
                        sessionStorage.setItem('pendingMeetingGeneration', appointmentId);
                        window.location.href = authUrlResponse.data.authUrl;
                    }
                } catch (authError) {
                    console.error('Auth URL error:', authError);
                    toast.error('Failed to setup Google authorization', { id: 'generate-meet' });
                }
            } else {
                toast.error(error.response?.data?.message || 'Failed to generate meeting link', { id: 'generate-meet' });
            }
        } finally {
            setGeneratingLink(prev => ({ ...prev, [appointmentId]: false }));
        }
    };

    // Notify patient about meeting link
    const notifyPatientAboutMeeting = async (appointmentId, meetingInfo) => {
        try {
            await axios.post(
                `http://localhost:2006/api/notifications/meeting-ready`,
                {
                    appointmentId,
                    meetingInfo
                },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Error notifying patient:', error);
            // Don't show error to user as the main operation succeeded
        }
    };

    // Join meeting as doctor
    const joinMeetingAsDoctor = async (appointmentId) => {
        try {
            toast.loading('Joining meeting...', { id: 'join-meet' });

            // Get meeting details
            const response = await axios.get(
                `http://localhost:2006/api/meetings/${appointmentId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
                const meetingInfo = response.data.meetingInfo;

                // Update doctor's join status
                await axios.post(
                    `http://localhost:2006/api/meetings/${appointmentId}/join`,
                    { role: 'doctor' },
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                toast.success('Opening Google Meet...', { id: 'join-meet' });

                // Open Google Meet in new tab
                window.open(meetingInfo.link, '_blank');

                // Update appointment status if needed
                await updateAppointmentStatus(appointmentId, 'In Progress');
            }
        } catch (error) {
            console.error('Error joining meeting:', error);
            toast.error('Failed to join meeting', { id: 'join-meet' });
        }
    };

    // Update appointment status - fix the endpoint
    const updateAppointmentStatus = async (appointmentId, status) => {
        try {
            await axios.put(
                `http://localhost:2006/api/appointments/${appointmentId}`,
                { status },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Error updating appointment status:', error);
        }
    };

    // Check auth callback on component mount - Enhanced
    useEffect(() => {
        // Check if returning from Google auth
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth');
        const authError = urlParams.get('error');
        const pendingAppointmentId = sessionStorage.getItem('pendingMeetingGeneration');

        if (authSuccess === 'success') {
            toast.success('Google Calendar authorized successfully!');

            if (pendingAppointmentId) {
                // Small delay to ensure tokens are set
                setTimeout(() => {
                    generateGoogleMeetLink(pendingAppointmentId);
                    sessionStorage.removeItem('pendingMeetingGeneration');
                }, 1000);
            }

            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        } else if (authError) {
            console.error('Auth error:', authError);
            toast.error('Google authorization failed. Please try again.');
            sessionStorage.removeItem('pendingMeetingGeneration');

            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const renderAppointmentActions = (appointment) => {
        const appointmentStatus = activeAppointments[appointment._id];
        const hasGeneratedLink = meetingLinks[appointment._id] || appointment.meeting?.isGenerated;

        return (
            <div className="flex space-x-2">
                {appointment.status === 'Confirmed' && (
                    <>
                        {!hasGeneratedLink ? (
                            <button
                                onClick={() => generateGoogleMeetLink(appointment._id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#4CAF50] text-white rounded-lg hover:bg-[#45a049] transition-colors"
                                disabled={generatingLink[appointment._id]}
                            >
                                {generatingLink[appointment._id] ? (
                                    <i className="ri-loader-4-line animate-spin"></i>
                                ) : (
                                    <i className="ri-video-add-line"></i>
                                )}
                                Generate Meet Link
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => joinMeetingAsDoctor(appointment._id)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    <i className="ri-video-chat-line"></i>
                                    Join Meeting
                                </button>

                                <button
                                    onClick={() => copyMeetingLink(appointment._id)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                    title="Copy meeting link"
                                >
                                    <i className="ri-file-copy-line"></i>
                                </button>
                            </>
                        )}
                    </>
                )}

                <button
                    onClick={() => navigate(`/doctor/appointments/${appointment._id}`)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    Details
                </button>
            </div>
        );
    };

    // Copy meeting link to clipboard
    const copyMeetingLink = async (appointmentId) => {
        try {
            const meetingInfo = meetingLinks[appointmentId];
            if (meetingInfo?.link) {
                await navigator.clipboard.writeText(meetingInfo.link);
                toast.success('Meeting link copied to clipboard');
            }
        } catch (error) {
            console.error('Error copying link:', error);
            toast.error('Failed to copy link');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Appointments</h2>
                    <p className="text-gray-500">Manage your upcoming and past appointments</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => navigate('/doctor/appointments')}
                        className={`${activeTab === 'requests'
                                ? 'border-[#4CAF50] text-[#4CAF50]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Pending Requests
                        {pendingRequests.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => navigate('/doctor/appointments/today')}
                        className={`${activeTab === 'today'
                                ? 'border-[#4CAF50] text-[#4CAF50]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Today's Schedule
                    </button>
                    <button
                        onClick={() => navigate('/doctor/appointments/upcoming')}
                        className={`${activeTab === 'upcoming'
                                ? 'border-[#4CAF50] text-[#4CAF50]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => navigate('/doctor/appointments/history')}
                        className={`${activeTab === 'past'
                                ? 'border-[#4CAF50] text-[#4CAF50]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Past Appointments
                    </button>
                </nav>
            </div>

            {/* Filters for upcoming and past appointments */}
            {activeTab !== 'requests' && activeTab !== 'today' && (
                <div className="flex space-x-4">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-[#4CAF50]"
                    />
                    {filterDate && (
                        <button
                            onClick={() => setFilterDate('')}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            )}

            {/* Content based on active tab */}
            {activeTab === 'requests' ? renderPendingRequests() : renderAppointmentsList()}

            {/* Decline Reason Modal */}
            {showDeclineModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-semibold mb-4">Decline Appointment Request</h3>
                        <p className="text-gray-600 mb-4">Please provide a reason for declining this appointment:</p>
                        <textarea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
                            rows="3"
                            placeholder="Enter reason (optional)"
                        ></textarea>
                        <div className="flex justify-end mt-4 space-x-3">
                            <button
                                onClick={() => setShowDeclineModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeclineRequest}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;
//     <div>



//         {/* Content based on active tab */}
//         {activeTab === 'requests' ? renderPendingRequests() : renderAppointmentsList()}

//         {/* Decline Reason Modal */}
//         {showDeclineModal && (
//             <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
//                 <div className="bg-white rounded-xl p-6 w-full max-w-md">
//                     <h3 className="text-xl font-semibold mb-4">Decline Appointment Request</h3>
//                     <p className="text-gray-600 mb-4">Please provide a reason for declining this appointment:</p>
//                     <textarea
//                         value={declineReason}
//                         onChange={(e) => setDeclineReason(e.target.value)}
//                         className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/20 focus:border-[#4CAF50]"
//                         rows="3"
//                         placeholder="Enter reason (optional)"
//                     ></textarea>
//                     <div className="flex justify-end mt-4 space-x-3">
//                         <button
//                             onClick={() => setShowDeclineModal(false)}
//                             className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
//                         >
//                             Cancel
//                         </button>
//                         <button
//                             onClick={handleDeclineRequest}
//                             className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
//                         >
//                             Decline
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         )}
//     </div>

// };

// export default Appointments;