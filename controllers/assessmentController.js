const Assessment = require('../models/assessmentModel');
const User = require('../models/userModel');

exports.startAssessment = async (req, res) => {
  try {
    const { assessmentNumber } = req.body;
    const userId = req.user.id; // Assuming you have auth middleware

    // Check if assessment already exists and is completed
    const existingAssessment = await Assessment.findOne({ 
      userId, 
      assessmentNumber,
      status: 'completed'
    });

    if (existingAssessment) {
      return res.status(400).json({
        success: false,
        message: 'Assessment already completed',
        completed: true,
        assessment: existingAssessment
      });
    }

    const assessment = new Assessment({
      userId,
      assessmentNumber,
      ageRange: `${(assessmentNumber - 1) * 3}-${assessmentNumber * 3} months`,
      status: 'in-progress'
    });

    await assessment.save();

    res.status(201).json({
      success: true,
      message: 'Assessment started',
      assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error starting assessment',
      error: error.message
    });
  }
};

exports.submitAnswers = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { answers, concerns } = req.body;
    const userId = req.user.id;

    const assessment = await Assessment.findOne({ _id: assessmentId, userId });
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Update assessment
    assessment.answers = answers;
    assessment.concerns = concerns;
    assessment.status = 'completed';
    
    // Calculate scores and risk assessment
    assessment.calculateScores();
    
    await assessment.save();

    // Increment user's completed assessments counter
    await User.findByIdAndUpdate(
      userId,
      { $inc: { completedAssessments: 1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Assessment completed',
      assessment,
      completedAssessments: (await User.findById(userId)).completedAssessments,
      riskAssessment: assessment.riskAssessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting answers',
      error: error.message
    });
  }
};

exports.getAssessmentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const assessments = await Assessment.find({ userId })
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      assessments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment history',
      error: error.message
    });
  }
};

exports.getAssessmentById = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    const assessment = await Assessment.findOne({ _id: assessmentId, userId });
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    res.status(200).json({
      success: true,
      assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment',
      error: error.message
    });
  }
};

// Add new controller method for checking assessment status
exports.checkAssessment = async (req, res) => {
  try {
    const { assessmentNumber } = req.params;
    const userId = req.user.id;

    const assessment = await Assessment.findOne({ 
      userId, 
      assessmentNumber,
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      completed: !!assessment,
      assessment: assessment || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking assessment status',
      error: error.message
    });
  }
};

// Add a new method to get completed assessments count
exports.getCompletedCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user data
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Return completed assessment count
    return res.status(200).json({
      success: true,
      completedAssessments: user.completedAssessments || 0
    });
    
  } catch (error) {
    console.error('Error fetching completed count:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching completed assessments count'
    });
  }
};

exports.getChildStats = async (req, res) => {
  try {
    // This would be replaced with actual stats calculation
    // For now, just return some placeholder data
    return res.status(200).json({
      success: true,
      stats: {
        developmentScore: 85,
        completionRate: 70,
        nextAssessmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('Error fetching child stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching child statistics'
    });
  }
};

// Add a new endpoint to get detailed assessment results
exports.getAssessmentResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    const assessment = await Assessment.findOne({ _id: assessmentId, userId });
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // If assessment doesn't have risk assessment data, calculate it
    if (!assessment.riskAssessment) {
      assessment.calculateScores();
      await assessment.save();
    }

    res.status(200).json({
      success: true,
      assessment: {
        id: assessment._id,
        assessmentNumber: assessment.assessmentNumber,
        ageRange: assessment.ageRange,
        completedAt: assessment.completedAt,
        overallScore: assessment.overallScore,
        categoryScores: assessment.categoryScores,
        riskAssessment: assessment.riskAssessment
      }
    });
  } catch (error) {
    console.error('Error fetching assessment results:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment results',
      error: error.message
    });
  }
};
