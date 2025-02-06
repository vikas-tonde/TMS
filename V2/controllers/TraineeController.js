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
      orderBy: { date: "desc" },
      select: {
        value: true,
        date: true,
        remarkedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
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

const getAssessmentByModules = async (req, res) => {
  try {
    let assessment = await prisma.userAssessment.findMany({ 
      where: { userId: req.user.id },
      select:{
        marksObtained: true,
        assessment: {
          select: {
            totalMarks: true,
            module: true
          }
        }
      }
     });
    return res.status(200).json(new ApiResponse(200, { assessment }, "Assessment details are fetched."));
  } catch (error) {
    logger.error("Error fetching Assessment details:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong fetching Assessment details."));
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

    let languageIds = languages?.filter(language => !language.__isNew__).map(language => BigInt(language.value));
    let skillIds = skills?.filter(skill => !skill.__isNew__).map(skill => BigInt(skill.value));

    let newLanguages = languages?.filter(language => language.__isNew__).map(language => language.label) || [];
    let newSkills = skills?.filter(skill => skill.__isNew__).map(skill => skill.label) || [];

    let user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "User does not exist in system."));
    }

    if (languageIds && languageIds.length > 0) {
      let languages = await prisma.language.findMany({ where: { id: { in: languageIds } } });
      if (languages.length !== languageIds.length) {
        return res.status(400).json(new ApiResponse(400, {}, "One or more language ids are invalid."));
      }
    }

    if (skillIds && skillIds.length > 0) {
      let skills = await prisma.skill.findMany({ where: { id: { in: skillIds } } });
      if (skills.length !== skillIds.length) {
        return res.status(400).json(new ApiResponse(400, {}, "One or more skill ids are invalid."));
      }
    }

    if (newLanguages.length > 0) {
      let createdLanguages = await Promise.all(
        newLanguages.map(async label => {
          return await prisma.language.create({
            data: { languageName: label }
          });
        })
      );

      createdLanguages.forEach(language => {
        languageIds.push(language.id);
      });
    }

    if (newSkills.length > 0) {
      let createdSkills = await Promise.all(
        newSkills.map(async label => {
          return await prisma.skill.create({
            data: { skillName: label }
          });
        })
      );

      createdSkills.forEach(skill => {
        skillIds.push(skill.id);
      });
    }

    let savedUser = await prisma.$transaction(async tx => {
      let userLanguages = await tx.userLanguages.findMany({ where: { userId: user.id } });
      let existingLanguageIds = userLanguages.map(language => language.languageId);
      let newLanguages = languageIds?.filter(languageId => !existingLanguageIds.includes(languageId)) || [];
      let removedLanguages = existingLanguageIds?.filter(languageId => !languageIds?.includes(languageId)) || [];

      if (newLanguages.length) {
        await tx.userLanguages.createMany({
          data: newLanguages.map(languageId => ({ userId: user.id, languageId }))
        });
      }

      if (removedLanguages.length) {
        await tx.userLanguages.deleteMany({
          where: { userId: user.id, languageId: { in: removedLanguages } }
        });
      }

      let userSkills = await tx.userSkills.findMany({ where: { userId: user.id } });
      let existingSkillIds = userSkills.map(skill => skill.skillId);
      let newSkills = skillIds.filter(skillId => !existingSkillIds.includes(skillId)) || [];
      let removedSkills = existingSkillIds.filter(skillId => !skillIds.includes(skillId)) || [];

      if (newSkills.length) {
        await tx.userSkills.createMany({
          data: newSkills.map(skillId => ({ userId: user.id, skillId }))
        });
      }

      if (removedSkills.length) {
        await tx.userSkills.deleteMany({
          where: { userId: user.id, skillId: { in: removedSkills } }
        });
      }
    });

    return res.status(200).json(new ApiResponse(200, user, "Skills and Languages updated successfully."));
  } catch (error) {
    logger.error("Error while updating skills and languages:", error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while updating skills and languages."));
  }
};

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
  getAssessmentCountByType, getBatches, getExams, getOngoingTrainingOfUser, addOrDeleteSkillsAndLanguages, getAssessmentByModules, getSkillsAndLanguages, getQuizCount, getQuizPercentage, getRemarks, getTrainingInProgressCount, getTrainings
};
