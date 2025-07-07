const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    enum: ['yes', 'no', 'not sure'],
    required: true
  },
  category: {
    type: String,
    enum: ['Gross Motor', 'Fine Motor', 'Language/Communication', 'Cognitive', 'Social/Emotional'],
    required: true
  },
  // Add points field for scoring
  points: {
    type: Number,
    default: 0
  }
});

const assessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assessmentNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 19
  },
  ageRange: {
    type: String,
    required: true
  },
  answers: [answerSchema],
  concerns: {
    type: String,
    trim: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed', 'in-progress', 'flagged'],
    default: 'completed'
  },
  flaggedQuestions: [{
    questionId: String,
    category: String,
    reason: String
  }],
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },
  categoryScores: {
    grossMotor: Number,
    fineMotor: Number,
    language: Number,
    cognitive: Number,
    socialEmotional: Number
  },
  recommendations: [{
    category: String,
    text: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low']
    }
  }],
  riskAssessment: {
    isAtRisk: Boolean,
    riskLevel: {
      type: String,
      enum: ['none', 'low', 'moderate', 'high'],
      default: 'none'
    },
    riskAreas: [String],
    recommendation: String,
    needsAppointment: Boolean
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
assessmentSchema.index({ userId: 1, assessmentNumber: 1 }, { unique: true });
assessmentSchema.index({ userId: 1, completedAt: -1 });

// Virtual field for age at assessment
assessmentSchema.virtual('ageAtAssessment').get(function() {
  return this.ageRange.split('-')[0] + ' months';
});

// Enhance calculateScores method to determine risk levels
assessmentSchema.methods.calculateScores = function() {
  const categoryCounts = {};
  const categoryTotals = {};
  const categoryPoints = {};
  const riskAreas = [];

  this.answers.forEach(answer => {
    if (!categoryCounts[answer.category]) {
      categoryCounts[answer.category] = 0;
      categoryTotals[answer.category] = 0;
      categoryPoints[answer.category] = 0;
    }
    
    categoryTotals[answer.category]++;
    
    // Assign points based on answer type
    let points = 0;
    if (answer.answer === 'yes') {
      categoryCounts[answer.category]++;
      points = 1; // Normal development
    } else if (answer.answer === 'no') {
      points = -2; // Potential concern
    } else if (answer.answer === 'not sure') {
      points = -1; // Possible concern
    }
    
    // Store points with the answer
    answer.points = points;
    categoryPoints[answer.category] += points;
  });

  // Calculate category scores
  this.categoryScores = {
    grossMotor: (categoryCounts['Gross Motor'] / categoryTotals['Gross Motor']) * 100,
    fineMotor: (categoryCounts['Fine Motor'] / categoryTotals['Fine Motor']) * 100,
    language: (categoryCounts['Language/Communication'] / categoryTotals['Language/Communication']) * 100,
    cognitive: (categoryCounts['Cognitive'] / categoryTotals['Cognitive']) * 100,
    socialEmotional: (categoryCounts['Social/Emotional'] / categoryTotals['Social/Emotional']) * 100
  };

  // Calculate overall score
  const totalYes = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const totalQuestions = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  this.overallScore = (totalYes / totalQuestions) * 100;

  // Determine risk areas - any category below 70% is considered at risk
  Object.entries(this.categoryScores).forEach(([key, score]) => {
    if (score < 70) {
      // Map technical names to user-friendly names
      const categoryMap = {
        grossMotor: 'Gross Motor Skills',
        fineMotor: 'Fine Motor Skills',
        language: 'Language/Communication',
        cognitive: 'Cognitive Development',
        socialEmotional: 'Social/Emotional Development'
      };
      riskAreas.push(categoryMap[key]);
    }
  });

  // Determine risk level
  let riskLevel = 'none';
  if (this.overallScore < 50) {
    riskLevel = 'high';
  } else if (this.overallScore < 70) {
    riskLevel = 'moderate';
  } else if (this.overallScore < 85) {
    riskLevel = 'low';
  }

  // Create risk assessment object
  this.riskAssessment = {
    isAtRisk: this.overallScore < 85,
    riskLevel,
    riskAreas,
    recommendation: this.generateRecommendation(riskLevel, riskAreas),
    needsAppointment: this.overallScore < 70 // Recommend appointment for moderate to high risk
  };

  return this.overallScore;
};

// New method to generate recommendations
assessmentSchema.methods.generateRecommendation = function(riskLevel, riskAreas) {
  if (riskLevel === 'none' || riskAreas.length === 0) {
    return "Your child appears to be developing normally. Continue with regular check-ups.";
  }

  if (riskLevel === 'low') {
    return `Your child may need additional support in ${riskAreas.join(', ')}. Consider discussing these areas with your healthcare provider at your next visit.`;
  }

  if (riskLevel === 'moderate') {
    return `We recommend scheduling an appointment with a specialist to discuss your child's development in ${riskAreas.join(', ')}. Early intervention can be beneficial.`;
  }

  if (riskLevel === 'high') {
    return `It's important to schedule an appointment with a specialist as soon as possible to evaluate your child's development in ${riskAreas.join(', ')}. Early intervention is critical.`;
  }

  return "Please consult with your healthcare provider about your child's development.";
};

// Pre-save middleware to calculate scores
assessmentSchema.pre('save', function(next) {
  if (this.status === 'completed') {
    this.calculateScores();
  }
  next();
});

const Assessment = mongoose.model('Assessment', assessmentSchema);

module.exports = Assessment;
