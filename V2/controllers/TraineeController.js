import prisma from "../../DB/db.config.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const getExams = async (req, res) => {
  try {
    let { batchId } = req.body;
    let query = {};
    if (batchId) {
      let batch = await prisma.batch.findUnique({ where: { id: BigInt(batchId) } });
      if (!batch) {
        return res.status(400).json(new ApiResponse(400, {}, "Batch id does not exist in system."));
      }
      query = { batches: { some: { id: batchId } } };
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
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching exam details."));
  }
}

const getRemarks = async (req, res) => {
  try {
    let remarks = await prisma.remark.findMany({
      where: { userId: req.user.id },
      orderBy: { date: "desc" }
    });
    return res.status(200).json(new ApiResponse(200, remarks, "Remarks fetched successfully."));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching Remarks."));
  }
}

const getBatches = async (req, res) => {
  try {
    let batches = await prisma.batch.findMany({ where: { users: { some: { userId: req.user.id } } } });
    return res.status(200).json(new ApiResponse(200, batches, "Batches fetched successfully."));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching batches."));
  }
}

const getQuizCount = async (req, res) => {
  try {
    let count = await prisma.userAssessment.count({ where: { userId: req.user.id, assessment: { assessmentType: "Quiz" } } });
    return res.status(200).json(new ApiResponse(200, { count }, "Couts of quizes fetched."));
  } catch (error) {
    console.log(error);
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
    console.log(result);
    return res.status(200).json(new ApiResponse(200, result[0], "percentage of quizes fetched."));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching quiz count."));
  }
}

export {
  getExams,
  getBatches,
  getRemarks,
  getQuizCount,
  getQuizPercentage
};

