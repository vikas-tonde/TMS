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
      query = { batches: { every: { id: batchId } } };
    }
    query = { ...query, users: { every: { userId: req.user.id } } };
    let examDetails = await prisma.assessment.findMany({
      where: { ...query },
      include: { users: { select: { marksObtained: true } }, module: true }
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

export {
  getExams,
  getRemarks
};

