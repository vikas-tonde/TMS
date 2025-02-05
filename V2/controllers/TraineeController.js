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

const getSkillsAndLanguages = async (req, res) => {
  try {
    let skills = await prisma.skill.findMany({});
    let languages = await prisma.language.findMany({});
    const SkillsAndLanguages = { skills: skills, languages: languages };

    return res.status(200).json(new ApiResponse(200, SkillsAndLanguages, "Skills and Languages are fetched successfully."));
  } catch (error) {
    logger.error("Error fetching skills and languages: ", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching Skills and Languages."));
  }
};

const getQuizCount = async (req, res) => {
  try {
    let count = await prisma.userAssessment.count({ where: { userId: req.user.id } });
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
    let trainings = await prisma.userTraining.findMany({
      where: {
        userId: req.user.id,
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
    if (trainings.length) {
      return res.status(200).json(new ApiResponse(200, trainings, "Trainings are fetched successfully."));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No ongoing training found."));
  } catch (error) {
    logger.error("Error fetching trainings:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching ongoing trainings."));
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

const addOrDeleteSkillsAndLanguages = async (req, res) => {
  try {
    const { languages, skills } = req.body;

    if (!Array.isArray(languages) || !Array.isArray(skills)) {
      return res.status(400).json(new ApiResponse(400, {}, "Languages and skills must be arrays"));
    }

    let user = await prisma.user.findUnique({ where: { userId: req.user.id } });
    console.log(user);
    
    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "User does not exist in system."));
    }

    // 3. Process the addition of new languages and skills
    const languagesToAdd = languages.filter(lang => !user.languages.includes(lang)); // Filter out languages already in the user's profile
    const skillsToAdd = skills.filter(skill => !user.skills.includes(skill)); // Filter out skills already in the user's profile

    // 4. Add new languages and skills
    if (languagesToAdd.length > 0) {
      user.languages.push(...languagesToAdd);
    }
    if (skillsToAdd.length > 0) {
      user.skills.push(...skillsToAdd);
    }

    // 5. Process the deletion of unwanted languages and skills
    const languagesToDelete = user.languages.filter(lang => !languages.includes(lang)); // Get languages to be removed
    const skillsToDelete = user.skills.filter(skill => !skills.includes(skill)); // Get skills to be removed

    // 6. Remove the languages and skills that are no longer selected
    user.languages = user.languages.filter(lang => !languagesToDelete.includes(lang));
    user.skills = user.skills.filter(skill => !skillsToDelete.includes(skill));

    // 7. Save the updated user profile
    await user.save();

    // 8. Return success response
    return res.status(200).json(new ApiResponse(200, user, "Skills and Languages updated successfully."));
  } catch (error) {
    logger.error("Error while updating skills and languages:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while updating skills and languages."));
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
    let ongoingTrainings = await prisma.userTraining.findMany({
      where: {
        userId: req.user.id,
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
      return res.status(200).json(new ApiResponse(200, ongoingTrainings, "Ongoing Trainings are fetched successfully."));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No ongoing training found."));
  } catch (error) {
    logger.error("Error fetching trainings:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching ongoing trainings."));
  }
}

export {
  getAssessmentCountByType, getBatches, getExams, getOngoingTrainingOfUser, addOrDeleteSkillsAndLanguages, getSkillsAndLanguages, getQuizCount, getQuizPercentage, getRemarks, getTrainingInProgressCount, getTrainings
};

