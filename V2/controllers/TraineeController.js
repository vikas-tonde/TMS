import prisma from "../../DB/db.config.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import logger from "../../utils/logger.js";

const getExams = async (req, res) => {
  try {
    let { batchId } = req.params;
    let query = {};
    if (batchId) {
      let batch = await prisma.batch.findUnique({ where: { id: BigInt(batchId) } });
      if (!batch) {
        return res.status(400).json(new ApiResponse(400, {}, "Batch id does not exist in system."));
      }
      query = { batches: { every: { id: batchId } } };
    }
    query = { ...query, users: { some: { userId: req.user.id } } };
    let examDetails = await prisma.assessment.findMany({
      where: { ...query },
      include: { users: { where: { userId: req.user.id }, select: { marksObtained: true } }, module: true }
    });
    if (examDetails.length) {
      examDetails = examDetails.map(details => {
        return {
          id: details.id,
          module: details.module,
          date: details.date,
          assessmentName: details.assessmentName,
          totalMarks: details.totalMarks,
          assessmentType: details.assessmentType,
          marksObtained: details.users[0].marksObtained
        };
      });
    }
    return res.status(200).json(new ApiResponse(200, examDetails, "Assessment details fetched successfully."));
  } catch (error) {
    logger.error("Error fetching exam details:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching exam details."));
  }
}

const getRemarks = async (req, res) => {
  try {
    let remarks = await prisma.remark.findMany({
      where: { userId: req.user.id },
      orderBy: { date: "desc" }
    });
    return res.status(200).json(new ApiResponse(200, { remarks }, "Remarks fetched successfully."));
  } catch (error) {
    logger.error("Error fetching remarks:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching Remarks."));
  }
}

const getBatches = async (req, res) => {
  try {
    let batches = await prisma.batch.findMany({ where: { users: { some: { userId: req.user.id } } } });
    return res.status(200).json(new ApiResponse(200, batches, "Batches fetched successfully."));
  } catch (error) {
    logger.error("Error fetching batches:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching batches."));
  }
}

const getQuizCount = async (req, res) => {
  try {
    let count = await prisma.userAssessment.count({ where: { userId: req.user.id, assessment: { assessmentType: "Quiz" } } });
    return res.status(200).json(new ApiResponse(200, { count }, "Couts of quizes fetched."));
  } catch (error) {
    logger.error("Error fetching quiz count:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching quiz count."));
  }
}

const getQuizPercentage = async (req, res) => {
  try {
    let result = await prisma.$queryRaw`
    select ((sum(ua."marksObtained")::float / sum(a."totalMarks")::float) * 100) as percentage
    from public."UserAssessment" ua
    JOIN public."Assessment" a ON a.id = ua."assessmentId"
    where ua."userId"=${req.user.id}
    `;
    return res.status(200).json(new ApiResponse(200, result[0], "percentage of quizes fetched."));
  } catch (error) {
    logger.error("Error fetching quiz percentage:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching quiz count."));
  }
}

const getTrainings = async (req, res) => {
  try {
    let trainings = await prisma.training.findMany({ where: { users: { every: { userId: req.user.id } } } });
    return res.status(200).json(new ApiResponse(200, trainings, "Trainings fetched successfully."));
  } catch (error) {
    logger.error("Error fetching trainings:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching trainings."));
  }
}

const getTrainingInProgressCount = async (req, res) => {
  try {
    let count = await prisma.userTraining.count({
      where: { userId: req.user.id, isCompleted: false }
    });
    return res.status(200).json(new ApiResponse(200, { count }, "Training in progress fetched successfully."));
  } catch (error) {
    logger.error("Error fetching in progress training count:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching training in progress."));
  }
}

const getAssessmentCountByType = async (req, res) => {
  try {
    let result = await prisma.$queryRaw`
    select a."assessmentType", count(ua."assessmentId") as count
    from public."UserAssessment" ua
    JOIN public."Assessment" a ON a.id = ua."assessmentId"
    where ua."userId"=${req.user.id}
    group by a."assessmentType"
    `;
    return res.status(200).json(new ApiResponse(200, result, "Assessment count by type fetched."));
  } catch (error) {
    logger.error("Error fetching assessment count by type:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching assessment count by type."));
  }
}

const getOngoingTrainingOfUser = async (req, res) => {
  try {
    let { employeeId } = req.params;
    let user = await prisma.user.findUnique({
      where: { employeeId: String(employeeId) },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }
    let ongoingTrainings = await prisma.userTraining.findMany({
      where: {
        userId: user.id,
        isCompleted: false
      },
      select: {
        training: {
          select: {
            trainingName: true,
            duration: true
          }
        },
        assignedDate: true,
        isCompleted: true,
        completionDate: true
      }
    });
    if (ongoingTrainings.length) {
      return res.status(200).json(new ApiResponse(200, ongoingTrainings));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No ongoing training found."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching ongoing trainings."));
  }
}

export {
  getExams,
  getBatches,
  getRemarks,
  getQuizCount,
  getTrainings,
  getQuizPercentage,
  getOngoingTrainingOfUser,
  getAssessmentCountByType,
  getTrainingInProgressCount,
};

