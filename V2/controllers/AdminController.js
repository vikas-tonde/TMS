import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import excelToJson from "convert-excel-to-json";
import { validationResult } from 'express-validator';
import * as fs from 'fs-extra';
import prisma from '../../DB/db.config.js';
import { ApiResponse } from "../../utils/ApiResponse.js";
import logger from '../../utils/logger.js';
import { mailHandler } from '../../utils/mailer.js';
import { ROLES } from '../../utils/roles.js';

const readExcelFile = async (filePath, sheetName) => {
  return excelToJson({
    sourceFile: filePath,
    header: {
      rows: 1,
    },
    columnToKey: {
      "*": "{{columnHeader}}",
    },
    sheets: sheetName || ["Sheet1"]
  });
}

const validateIncomingUsers = (incomingUsers) => {
  for (let incomingUser of incomingUsers) {
    if (!(incomingUser?.firstName && incomingUser?.lastName && incomingUser?.email && incomingUser?.password && incomingUser?.employeeId)) {
      return false;
    }
  }
  return true;
}


const bulkUsersFromFile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (req.file?.filename == null || req.file?.filename == undefined) {
      logger.warn("File is not sent.");
      return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
    }
    else {
      var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
      const excelData = await readExcelFile(filePath, ["Sheet1"]);
      let users = excelData.Sheet1;
      if (!validateIncomingUsers(users)) {
        logger.warn("All fields not present for all users.");
        return res.status(400).json(new ApiResponse(400, {}, "All fields not present for all users."));
      }
      const userBatches = [];
      let timeout = users.length * 1000;
      await prisma.$transaction(async tx => {
        let { batchName, location } = req.body;
        let locationRecord = await tx.location.findFirst({
          where: { name: location }
        });
        if (!locationRecord) {
          logger.warn(`Location ${location} does not present in system.`);
          return res.status(400).json(new ApiResponse(400, {}, "Invalid value for location"));
        }
        let oldBatch = await tx.batch.updateMany({
          data: { isLatest: false },
          where: {
            locationId: locationRecord.id,
            isLatest: true,
          },
        });

        let newBatch = await tx.batch.create({
          data: { batchName: batchName, locationId: locationRecord.id }
        });
        logger.audit(`Batch ${newBatch.batchName} is created by user ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
        let usersToBeSaved = [];
        let usersAlreadyPresent = [];
        let role = await tx.role.findFirst({ where: { name: ROLES.TRAINEE } });

        for (let user of users) {
          let userAlreadyPresnt = await tx.user.findFirst({
            where: { OR: [{ email: user.email }, { employeeId: String(user.employeeId) }] }
          });
          if (userAlreadyPresnt) {
            usersAlreadyPresent.push(userAlreadyPresnt);
          }
          else {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
            user.userRole = role.id;
            user.locationId = locationRecord.id;
            user.employeeId = String(user.employeeId);
            usersToBeSaved.push(user);
          }
        }
        let savedUsers = [];
        if (usersToBeSaved.length) {
          savedUsers = await tx.user.createManyAndReturn({ data: usersToBeSaved });
          logger.audit(`${savedUsers.length} users are newly added in the system by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
        }

        users = [...savedUsers, ...usersAlreadyPresent];
        for (const user of users) {
          userBatches.push({ userId: user.id, batchId: newBatch.id, });
        }
        if (userBatches.length) {
          await tx.userBatch.createMany({ data: userBatches });
        }
        return userBatches;
      },
        {
          timeout
        }
      );
      fs.remove(filePath);
      logger.audit(`${userBatches.length} users attached to the newly created batch in the system by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
      return res.status(200).json(new ApiResponse(200, userBatches.length + " Users saved", "User uploading is finished"));
    }
  }
  catch (e) {
    logger.error(e);
    res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
  }
}

const addBulkTestDataofUsers = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(new ApiResponse(400, { errors: errors.array() }, "Errors in request"));
    }
    if (req.file?.filename == null || req.file?.filename == undefined) {
      logger.warn("File is not sent.");
      return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
    }
    else {
      var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
      const excelData = await readExcelFile(filePath, ["Sheet1"]);
      let { batchId } = req.body;
      let employeeIds = excelData.Sheet1.map(({ employeeId }) => String(employeeId));
      let batch = await prisma.batch.findUnique({
        where: { id: BigInt(batchId) }
      });
      let presentIdsSystem = await prisma.user.findMany({
        where: { employeeId: { in: employeeIds }, },
        select: { employeeId: true }
      });
      let missingIdsSystem = employeeIds.filter(id => !presentIdsSystem.some(obj => obj.employeeId === id));

      if (missingIdsSystem.length) {
        logger.warn(missingIdsSystem.join(",") + " users are not present in the system.");
        return res.status(400).json(new ApiResponse(400, {}, missingIdsSystem.join(",") + " users are not present in the system."));
      }
      let presentIdsBatch = await prisma.user.findMany({
        where: { batches: { some: { batchId: batch.id } }, },
        select: { employeeId: true }
      });
      let missingIdsBatch = employeeIds.filter(id => !presentIdsBatch.some(obj => obj.employeeId === id));
      if (missingIdsBatch.length) {
        logger.warn(missingIdsSystem.join(",") + " users are not present in the Batch " + batch.batchName + ".");
        return res.status(400).json(new ApiResponse(400, {}, missingIdsBatch.join(",") + " users are not present in the Batch."));
      }
      const timeout = employeeIds.length * 1000;
      let assessment = await prisma.$transaction(async tx => {
        let module = await tx.module.findFirst({
          where: { moduleName: req.body.moduleName }
        });
        if (!module) {
          logger.warn(`Module ${req.body.moduleName} does not present in system.`);
          return res.status(400).json(new ApiResponse(400, {}, "Invalid value for module"));
        }
        let users = [];
        for (const object of excelData.Sheet1) {
          let user = await tx.user.findUnique({
            where: { employeeId: String(object.employeeId) },
            select: { id: true, employeeId: true, }
          });
          users.push({ userId: user.id, marksObtained: object.marks })
        }
        let date = new Date(req.body.date);
        const assessment = await tx.assessment.create({
          data: {
            assessmentName: req.body.assessmentName,
            date: new Date(date.toISOString()),
            totalMarks: parseInt(req.body.totalMarks),
            assessmentType: req.body.assessmentType,
            module: { connect: { id: module.id } },
            batches: { connect: { id: batch.id } },
            users: { create: users },
          }
        });
        return assessment;
      },
        {
          timeout
        }
      );
      fs.remove(filePath);
      logger.debug("Assessment details are saved.");
      logger.audit(`Assessment ${assessment.assessmentName} is added in system by user ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
      return res.status(200).json(new ApiResponse(200, assessment, "Assessment details are saved."));
    }
  }
  catch (e) {
    logger.error(e);
    res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
  }
}

const allUsers = async (req, res) => {
  try {
    let { location, batchId } = req.params;
    let locationRecord = await prisma.location.findFirst({
      where: { name: location }
    });

    if (!locationRecord) {
      logger.warn(`Invalid location ${location}.`);
      return res.status(400).json(new ApiResponse(400, {}, "Invalid location..."));
    }

    let clause = Prisma.sql`b."locationId" = ${locationRecord.id} AND b."isLatest" = true`;
    if (batchId) {
      let batchRecord = await prisma.batch.findUnique({ where: { id: batchId } });
      if (!batchRecord) {
        logger.warn(`Invalid batch Id ${batchId}.`);
        return res.status(400).json(new ApiResponse(400, {}, "Invalid batch Id...."));
      }
      clause = Prisma.sql`b."id" = ${BigInt(batchId)} AND b."locationId" = ${locationRecord.id}`;
    }
    const result = await prisma.$queryRaw`
      SELECT u."employeeId", u.id::text, u."firstName", u."lastName", u.email, u."profileImage", 
        ((sum(ua."marksObtained")::float / sum(a."totalMarks")::float) * 100) as percentage
      FROM public."User" u
      JOIN public."UserBatch" ub ON u.id = ub."userId"
      JOIN public."Batch" b ON b.id = ub."batchId"
      JOIN public."UserAssessment" ua ON u.id = ua."userId"
      JOIN public."Assessment" a ON a.id = ua."assessmentId"
      JOIN "_assessmentToBatch" ab ON ab."B" = b.id
      WHERE ${clause} and u."isActive"=true
      GROUP BY u.id ORDER BY percentage desc;
      `;
    if (result.length) {
      return res.status(200).json(new ApiResponse(200, result));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No records found"));
  } catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching users"));
  }
}

const getTraineeDetails = async (req, res) => {
  let { employeeId } = req.params;
  try {
    if (employeeId) {
      const userWithAssessments = await prisma.user.findUnique({
        where: {
          employeeId: employeeId,
        },
        select: {
          email: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          id: true,
          skills: {
            select: {
              skill: {
                select: {
                  skillName: true
                }
              }
            }
          },
          languages: {
            select: {
              language: {
                select: {
                  languageName: true
                }
              }
            }
          },
          remarks: {
            include: {
              remarkedBy: true
            },
            orderBy: { date: "desc" },
          },
          joinedAt: true,
          trainings: {
            select: {
              assignedDate: true,
              isCompleted: true,
              training: {
                select: {
                  id: true,
                  trainingName: true,
                  duration: true,
                }
              }
            }
          },
          assessments: {
            include: {
              assessment: {
                include: {
                  module: true
                }
              }
            },
          },
        },
      });

      let totalMarksObtained = 0;
      let totalMarks = 0;
      const assessments = userWithAssessments?.assessments.map((userAssessment) => {
        let assessment = userAssessment.assessment;
        assessment.marksObtained = userAssessment.marksObtained
        return assessment;
      });
      userWithAssessments.assessments = assessments;
      userWithAssessments.assessments.forEach((assessment) => {
        totalMarksObtained += assessment.marksObtained;
        totalMarks += assessment.totalMarks;
      });

      // Calculate percentage
      let percentage = 0;
      if (totalMarks) {
        percentage = (totalMarksObtained / totalMarks) * 100;
      }
      userWithAssessments.percentage = percentage;
      if (userWithAssessments) {
        return res.status(200).json(new ApiResponse(200, userWithAssessments));
      }
      logger.warn(`No trainee found for employeeId ${employeeId}`);
      return res.status(404).json(new ApiResponse(404, {}, `No trainee found for employeeId ${employeeId}`));
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

/**
 * This function is more focused on user management so this function will return only necessary details from users page perspective.
 */
const getUserDetails = async (req, res) => {
  let { employeeId } = req.params;
  try {
    if (employeeId) {
      const user = await prisma.user.findUnique({
        where: {
          employeeId: employeeId,
        },
        select: {
          email: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          batches: {
            select: {
              batch: {
                select: {
                  id: true,
                  batchName: true,
                }
              }
            }
          },
          trainings: {
            select: {
              training: {
                select: {
                  id: true,
                  trainingName: true,
                }
              }
            }
          },
          id: true,
          role: true,
          isActive: true,
          location: true
        },
      });
      if (user) {
        return res.status(200).json(new ApiResponse(200, user));
      }
      logger.warn(`No user found for employeeId ${employeeId}`);
      return res.status(404).json(new ApiResponse(404, {}, `No user found for employeeId ${employeeId}`));
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const addRemark = async (req, res) => {
  let { employeeId, remark } = req.body;

  if (!(employeeId && remark)) {
    logger.warn("employee id or remark is not sent.");
    return res.status(400).json(new ApiResponse(400, {}, "employeeId and remark is not sent."));
  }
  try {
    let date = new Date();
    let foundUser = await prisma.$transaction(async tx => {
      return await tx.user.update({
        where: { employeeId: employeeId },
        data: {
          remarks: { create: { value: remark, date: date, adminId: req.user.id } }
        },
        include: {
          remarks: {
            include: {
              remarkedBy: true
            },
          },
          location: true,
          assessments: {
            include: {
              assessment: {
                include: {
                  module: true
                }
              }
            },
          }
        }
      })
    });
    if (!foundUser) {
      logger.warn(`Employee not found with ${employeeId}`);
      return res.status(404).json(new ApiResponse(404, {}, `Employee not found with ${employeeId}`));
    }

    let adminsEmails = await prisma.user.findMany({ where: { userRole: 1, location: foundUser.location }, select: { email: true }});
    mailHandler(req.user, foundUser.email, adminsEmails, "New remark added", `Remark added for you by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, foundUser, `Remark added for user: [${foundUser.employeeId}]`));
  } catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllBatches = async (req, res) => {
  try {
    let { location } = req.params;
    let query = { isActive: true };
    if (location) {
      let locationRecord = await prisma.location.findFirst({ where: { name: location } });
      if (!locationRecord) {
        return res.status(404).json(new ApiResponse(404, {}, `Location you have sent doesn't exist in database.`));
      }
      query = { ...query, locationId: locationRecord.id };
    }
    let batches = await prisma.batch.findMany({ where: { ...query } });
    if (batches?.length) {
      return res.status(200).json(new ApiResponse(200, batches));
    }
    return res.status(404).json(new ApiResponse(404, {}, `No batches found for location ${location}`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllBatchesIncludingInactive = async (req, res) => {
  try {
    let batches = await prisma.batch.findMany({});
    if (batches?.length) {
      return res.status(200).json(new ApiResponse(200, batches));
    }
    return res.status(404).json(new ApiResponse(404, {}, `No batches found for location ${location}`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllTrainings = async (req, res) => {
  try {
    let trainings = await prisma.training.findMany({});
    if (trainings?.length) {
      return res.status(200).json(new ApiResponse(200, trainings));
    }
    return res.status(404).json(new ApiResponse(404, {}, `No trainings found for location ${location}`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getBatch = async (req, res) => {
  let { batchId } = req.params;
  try {
    if (batchId) {
      let batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: { location: true }
      });
      if (batch) {
        return res.status(200).json(new ApiResponse(200, batch));
      }
    }
    return res.status(404).json(new ApiResponse(404, {}, `No batch found.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, `Unable to find the batch with ID :${req.params.batchId}`));
  }
}

const getAllModules = async (req, res) => {
  try {
    let moduleNames = await prisma.module.findMany({ select: { moduleName: true } });
    if (moduleNames.length) {
      moduleNames = [...moduleNames.map(module => module.moduleName)];
      return res.status(200).json(new ApiResponse(200, moduleNames));
    }
    return res.status(404).json(new ApiResponse(404, {}, "No modules found."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllTrainees = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    let trainees = await prisma.user.findMany({
      where: { batches: { some: { batchId: batchId } } },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        joinedAt: true,
      }
    });
    if (trainees.length) {
      return res.status(200).json(new ApiResponse(200, trainees));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No trainees found"));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const addUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  } else {
    try {
      const { firstName, lastName, email, password, employeeId, location, batch, role } = req.body;
      let roleRecord = await prisma.role.findUnique({ where: { id: parseInt(role) } });
      if (!roleRecord) {
        return res.status(400).json(new ApiResponse(400, {}, "Invalid role."));
      }
      if (roleRecord.name !== "Admin") {
        let batchRecord = await prisma.batch.findUnique({ where: { id: BigInt(batch) } });
        if (!batchRecord) {
          return res.status(400).json(new ApiResponse(400, {}, "Invalid batch."));
        }
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const locationRecord = await prisma.location.findFirst({
        where: { name: location }
      });
      let user = await prisma.$transaction(async tx => {
        let user = await tx.user.create({
          data: {
            firstName, lastName, employeeId, email,
            password: hashedPassword,
            location: { connect: { id: locationRecord.id } },
            role: { connect: { id: parseInt(role) } }
          }
        });
        if (roleRecord.name !== "Admin") {
          await tx.userBatch.create({
            data: { batchId: BigInt(batch), userId: user.id }
          });
        }
        return user;
      });
      if (user) {
        logger.audit(`User: [${user.firstName} ${user.lastName} (${user.employeeId})] is added by user: [${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})].`);
        return res.status(200).json(new ApiResponse(200, user, "User registered successfully."));
      }
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong, user registration failed."));

    }
    catch (e) {
      logger.error(e);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while registering the user."));
    }
  }
}

const toggleUserIsActive = async (req, res) => {
  let { userIds, isActive } = req.body;
  if (userIds?.length > 0) {
    try {
      let data = {}
      if (isActive === true) {
        data = {
          joinedAt: new Date(Date.now()),
          isActive: true
        }
      }
      else {
        data = { isActive: false, joinedAt: null };
      }
      await prisma.$transaction(async tx => {
        let { count } = await tx.user.updateMany({
          where: {
            employeeId: { in: userIds }
          },
          data: data
        });
        return count;
      });
      logger.audit(`[${userIds.join(",")}] user(s) have been set to ${isActive ? "Active" : "Inactive"}.`);
      return res.status(200).json(new ApiResponse(200, {}, `[${userIds.join(",")}] user(s) have been set to ${isActive ? "Active" : "Inactive"}.`));
    } catch (error) {
      logger.error(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while setting user inactive."));
    }
  }
  else {
    return res.status(400).json(new ApiResponse(400, {}, "User Ids is not provided."));
  }
}

const setBatchInactive = async (req, res) => {
  console.log();

  let { batchId, isActive } = req.body;
  if (batchId) {
    try {
      let batch = await prisma.$transaction(async tx => {
        return await tx.batch.update({
          where: { id: batchId },
          data: { isActive: isActive || false }
        });
      });
      logger.audit(`Batch: [${batch.batchName}] have been set to ${isActive ? "Active" : "Inactive"} by user ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
      return res.status(200).json(new ApiResponse(200, {}, `Batch: [${batch.batchName}] have been set to ${isActive ? "Active" : "Inactive"}.`));
    } catch (error) {
      logger.error(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while setting batch inactive."));
    }
  }
  else {
    return res.status(400).json(new ApiResponse(400, {}, "Batch Id is not provided."));
  }
}

const getAssessmentsForSpecificBatch = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    let assessmentType = req.params.assessmentType;
    let assessments = await prisma.assessment.findMany({
      where: {
        assessmentType: assessmentType,
        batches: { every: { id: batchId } }
      },
      include: { module: true }
    });
    return res.status(200).json(new ApiResponse(200, assessments, "Assessments fetched successfully"));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching Assessments."));
  }
}

const getAssessmentsDetailsForSpecificBatch = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    const assessments = await prisma.assessment.findMany({
      where: {
        batches: {
          some: {
            id: BigInt(batchId),
          },
        },
      },
      include: {
        module: true
      }
    });
    return res.status(200).json(new ApiResponse(200, assessments, "Assessments fetched successfully"));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching Assessments."));

  }
}

const addSingleAssessmentDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  else {
    try {
      let operation = "updated";
      let { assessmentId, employeeId, obtainedMarks } = req.body;
      let user = await prisma.user.findUnique({ where: { employeeId: employeeId } });
      if (!user) {
        return res.status(404).json(new ApiResponse(404, {}, `There is no user with employee id ${employeeId}.`));
      }
      let assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } })
      if (!assessment) {
        return res.status(404).json(new ApiResponse(404, {}, `There is no assessment with id ${assessmentId}.`));
      }
      let userAssessment = await prisma.userAssessment.findFirst({
        where: { userId: user.id, assessmentId: BigInt(assessmentId) }
      });

      if (!userAssessment) {
        userAssessment = await prisma.userAssessment.create({
          data: { userId: user.id, assessmentId: BigInt(assessmentId), marksObtained: obtainedMarks }
        });
        operation = "added";
      }
      else {
        userAssessment = await prisma.userAssessment.update({
          data: { marksObtained: obtainedMarks },
          where: { userId_assessmentId: { userId: user.id, assessmentId: BigInt(assessmentId) } }
        });
      }
      return res.status(200).json(new ApiResponse(200, {}, `Exam details ${operation} successfully for employee id: ${employeeId}`));
    } catch (error) {
      logger.error(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding exam details."));
    }
  }
}

const getAssessmentDetails = async (req, res) => {
  try {
    let { assessmentId } = req.params;
    let details = await prisma.assessment.findUnique({
      where: { id: BigInt(assessmentId) },
      select: {
        assessmentName: true,
        assessmentType: true,
        date: true,
        id: true,
        totalMarks: true,
        module: { select: { moduleName: true } },
        users: {
          select: {
            marksObtained: true,
            user: {
              select: {
                email: true,
                employeeId: true,
                firstName: true,
                lastName: true
              }
            },
          }
        }
      }
    });
    details = {
      ...details,
      candidates: details.users.map(user => ({
        score: user.marksObtained,
        ...user.user
      }))
    };
    if (details) {
      return res.status(200).json(new ApiResponse(200, details));
    }
    else {
      return res.status(200).json(new ApiResponse(200, {}, `No data found`));
    }
  } catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getLocations = async (req, res) => {
  try {
    let data = await prisma.location.findMany({});
    if (data && data.length > 0) {
      data = data.map(location => location.name);
      return res.status(200).json(new ApiResponse(200, data, `${data.length} locations found.`));
    }
    return res.status(404).json(new ApiResponse(404, {}, `No location(s) found.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching locations."));
  }
}

const getAllTraineesByLocationsAndNotInBatch = async (req, res) => {
  let { location, batchId } = req.params;
  if (!location || !batchId) {
    return res.status(400).json(new ApiResponse(400, {}, `Batch Id or location is not sent.`));
  }
  try {
    let findBatch = await prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } });
    if (!findBatch) {
      return res.status(400).json(new ApiResponse(400, {}, `Invalid batch Id.`));
    }
    let findLocation = await prisma.location.findFirst({ where: { name: location }, select: { id: true } });
    if (!findLocation) {
      return res.status(400).json(new ApiResponse(400, {}, `Invalid location.`));
    }
    let users = await prisma.user.findMany({
      where: {
        batches: { none: { batchId: BigInt(batchId) } },
        locationId: findLocation.id,
        isActive: true,
        role: { name: "Trainee" }
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true
      }
    });
    return res.status(200).json(new ApiResponse(200, users, `${users.length} users found.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching trainees."));
  }
}

const getAllRoles = async (req, res) => {
  try {
    let roles = await prisma.role.findMany({});
    res.status(200).json(new ApiResponse(200, roles));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching roles."));
  }
}

const deleteAssessment = async (req, res) => {
  try {
    let { assessmentId } = req.params;
    let assessment = await prisma.assessment.findUnique({ where: { id: BigInt(assessmentId) } });
    if (!assessment) {
      return res.status(400).json(new ApiResponse(400, {}, "Assessment does not exist in system."));
    }
    await prisma.assessment.delete({ where: { id: BigInt(assessmentId) } });
    logger.audit(`Assessment: ${assessment.assessmentName} is deleted by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `Assessment: ${assessment.assessmentName} deleted successfully`));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while deleting assessment."));
  }
}

const deleteUser = async (req, res) => {
  try {
    let { userId } = req.params;
    let user = await prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "User does not exist in system."));
    }
    await prisma.user.delete({ where: { id: BigInt(userId) } });
    logger.audit(`User: ${user.employeeId} is deleted by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `User: ${user.employeeId} deleted successfully`));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while deleting user."));
  }
}

const deleteBatch = async (req, res) => {
  try {
    let { batchId } = req.params;
    let batch = await prisma.batch.findUnique({ where: { id: BigInt(batchId) } });
    if (!batch) {
      return res.status(400).json(new ApiResponse(400, {}, "Batch does not exist in system."));
    }
    await prisma.batch.delete({ where: { id: BigInt(batchId) } });
    logger.audit(`Batch: ${batch.batchName} is deleted by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, {}, `Batch: ${batch.batchName} is deleted successfully`));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while deleting batch."));
  }
}

const deleteTraining = async (req, res) => {
  try {
    let { trainingId } = req.params;
    let training = await prisma.training.findUnique({ where: { id: BigInt(trainingId) } });
    if (!training) {
      return res.status(400).json(new ApiResponse(400, {}, "Training does not exist in system."));
    }
    await prisma.training.delete({ where: { id: BigInt(trainingId) } });
    logger.error(`Training: ${training.trainingName} deleted by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, {}, `Training: ${training.trainingName} deleted successfully.`));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while deleting training."));
  }
}

const deleteLocation = async (req, res) => {
  try {
    let { locationName } = req.params;
    let location = await prisma.location.findFirst({ where: { name: locationName } });
    if (!location) {
      return res.status(400).json(new ApiResponse(400, {}, `Location not found: Invalid location ${locationName}.`));
    }

    let batches = await prisma.batch.findMany({ where: { locationId: location.id } });
    if (batches.length > 0) {
      return res.status(400).json(new ApiResponse(400, {}, `Location: ${locationName} is associated with batches. Please delete the batches first.`));
    }

    let users = await prisma.user.findMany({ where: { locationId: location.id } });
    if (users.length > 0) {
      return res.status(400).json(new ApiResponse(400, {}, `Location: ${locationName} is associated with users. Please delete the users first.`));
    }

    await prisma.location.delete({ where: { id: (location.id) } });
    logger.audit(`Location: ${locationName} deleted successfully by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `Location: ${locationName} deleted successfully`));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, `Something went wrong while deleting Location: ${locationName}.`));
  }
}

const deleteModules = async (req, res) => {
  try {
    let { modules } = req.body;
    if (!modules || modules.length === 0) {
      return res.status(400).json(new ApiResponse(400, {}, 'No module names provided.'));
    }

    let result = await prisma.module.findMany({ where: { moduleName: { in: modules } } });
    if (!result) {
      return res.status(400).json(new ApiResponse(400, {}, 'Provided modules are not found in the system.'));
    }

    if (result.length < modules.length) {
      return res.status(400).json(new ApiResponse(400, {}, 'Request of extra modules to be deleted which are not in the system.'));
    }

    let moduleIds = result.map(module => module.id);
    let trainings = await prisma.training.findMany({ where: { modules: { some: { moduleId: { in: moduleIds } } } } });
    if (trainings.length > 0) {
      return res.status(400).json(new ApiResponse(400, {}, 'Modules are associated with trainings. Please delete the trainings first.'));
    }

    let assessments = await prisma.assessment.findMany({ where: { moduleId: { in: moduleIds } } });
    if (assessments.length > 0) {
      return res.status(400).json(new ApiResponse(400, {}, 'Modules are associated with assessments. Please delete the assessments first.'));
    }

    await prisma.module.deleteMany({ where: { id: { in: moduleIds } } });

    logger.audit(`Modules: [${modules.join(", ")}] are deleted successfully by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, {}, `Modules: [${modules.join(", ")}] are deleted successfully.`));
  }
  catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, 'Something went wrong while deleting the modules.'));
  }
};

const deleteUsers = async (req, res) => {
  try {
    let { employeeIds } = req.body;

    if (!employeeIds || employeeIds.length === 0) {
      return res.status(400).json(new ApiResponse(400, {}, 'Zero users selected for deletion.'));
    }

    let result = await prisma.user.findMany({ where: { employeeId: { in: employeeIds } } });

    if (!result) {
      return res.status(400).json(new ApiResponse(400, {}, 'Selected users are not found in the system.'));
    }

    if (result.length < employeeIds.length) {
      return res.status(400).json(new ApiResponse(400, {}, 'Request of extra users to be deleted which are not in the system.'));
    }

    let userIds = result.map(user => user.id);
    let empIds = result.map(user => user.employeeId);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    logger.audit(`Users: [${empIds.join(", ")}] are deleted successfully ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `Users: [${empIds.join(", ")}] are deleted successfully.`));
  }
  catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, 'Something went wrong while deleting the modules.'));
  }
};

const addBatchForExistingUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { employeeId, batchId, location } = req.body;
    const user = await prisma.user.findUnique({ where: { employeeId: employeeId } });
    const batch = await prisma.batch.findUnique({ where: { id: BigInt(batchId) } });
    let result = await prisma.$transaction(async (tx) => {
      return await tx.userBatch.create({ data: { userId: user.id, batchId: batch.id } });
    });
    logger.audit(`User [${user.employeeId}] added into batch [${batch.batchName}] successfully.`)
    return res.status(200).json(new ApiResponse(200, {}, `User [${user.employeeId}] added into batch [${batch.batchName}] successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding user in batch."));
  }
}

const resetPassword = async (req, res) => {
  try {
    let { employeeId } = req.params;
    let user = await prisma.user.findUnique({
      where: { employeeId: String(employeeId) },
      select: { id: true, firstName: true }
    });
    if (!user) {
      return res.status(400).json(new ApiResponse(400, {}, "Employee does not exist in system."));
    }
    let password = user.firstName + "@123";
    let salt = await bcrypt.genSalt(10);
    password = await bcrypt.hash(password, salt);
    user = await prisma.user.update({ where: { id: user.id }, data: { password: password } });
    return res.status(200).json(new ApiResponse(200, {}, `Password of user ${user.employeeId} is set with ${user.firstName}@123.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while resetting password."));
  }
}

const updateUserDetails = async (req, res) => {
  try {
    let { employeeId } = req.params;
    let { firstName, lastName, isActive, location, role, email, batchIds, trainingIds } = req.body;

    batchIds = batchIds?.map(batchId => BigInt(batchId));
    trainingIds = trainingIds?.map(trainingId => BigInt(trainingId));

    let user = await prisma.user.findUnique({
      where: { employeeId: String(employeeId) },
      include: { location: true, role: true }
    });
    let areValuesFilled = (firstName || lastName || location || role || email || user.isActive == isActive);
    if (!areValuesFilled) {
      return res.status(400).json(new ApiResponse(400, {}, "All values are empty, nothing to update."));
    }
    let newUser = {};
    if (role && role != user.role.name) {
      let roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (!roleRecord) {
        return res.status(400).json(new ApiResponse(400, {}, "Given role does not exist in system."));
      }
      newUser.userRole = roleRecord.id;
    }
    if (location && location != user.location.name) {
      let locationRecord = await prisma.location.findUnique({ where: { name: location } });
      if (!locationRecord) {
        return res.status(400).json(new ApiResponse(400, {}, "Given location does not exist in system."));
      }
      newUser.locationId = locationRecord.id;
    }
    if (firstName && firstName != user.firstName) {
      newUser.firstName = firstName;
    }

    if (lastName && lastName != user.lastName) {
      newUser.lastName = lastName;
    }

    if (isActive != user.isActive) {
      newUser.isActive = isActive;
    }

    if (isActive != user.email) {
      newUser.email = email;
    }

    if (Object.keys(newUser).length === 0) {
      return res.status(200).json(new ApiResponse(200, {}, "No changes needed."));
    }

    if (batchIds && batchIds.length > 0) {
      let batches = await prisma.batch.findMany({ where: { id: { in: batchIds } } });
      if (batches.length != batchIds.length) {
        return res.status(400).json(new ApiResponse(400, {}, "One or more batch ids are invalid."));
      }
    }

    if (trainingIds && trainingIds.length > 0) {
      let trainings = await prisma.training.findMany({ where: { id: { in: trainingIds } } });
      if (trainings.length != trainingIds.length) {
        return res.status(400).json(new ApiResponse(400, {}, "One or more training ids are invalid."));
      }
    }
    let savedUser = await prisma.$transaction(async tx => {
      let userBatches = await tx.userBatch.findMany({ where: { userId: user.id } });
      let existingBatchIds = userBatches.map(batch => batch.batchId);
      let newBatches = batchIds?.filter(batchId => !existingBatchIds?.includes(batchId)) || [];
      let removedBatches = existingBatchIds?.filter(batchId => !batchIds?.includes(batchId)) || [];

      if (newBatches.length) {
        await tx.userBatch.createMany({
          data: newBatches.map(batchId => { return { userId: user.id, batchId: batchId } })
        });
      }

      if (removedBatches.length) {
        await tx.userBatch.deleteMany({
          where: { userId: user.id, batchId: { in: removedBatches } }
        });
      }

      let userTrainings = await tx.userTraining.findMany({ where: { userId: user.id } });
      let existingTrainingIds = userTrainings.map(training => training.trainingId);
      let newTrainings = trainingIds?.filter(trainingId => !existingTrainingIds?.includes(trainingId)) || [];
      let removedTrainings = existingTrainingIds?.filter(trainingId => !trainingIds?.includes(trainingId)) || [];

      if (newTrainings.length) {
        await tx.userTraining.createMany({
          data: newTrainings.map(trainingId => { return { userId: user.id, trainingId: trainingId } })
        });
        logger.audit(`User: ${user.employeeId} added to training(s): ${newTrainings.join(", ")}`);
      }
      if (removedTrainings.length) {
        await tx.userTraining.deleteMany({
          where: { userId: user.id, trainingId: { in: removedTrainings } }
        });
        logger.audit(`User: ${user.employeeId} removed from training(s): ${removedTrainings.join(", ")}`);
      }
      return await tx.user.update({
        where: { employeeId: String(employeeId) },
        data: newUser
      });
    });

    if (savedUser) {
      logger.info(`User details of ${savedUser.employeeId} updated successfully.`);
      return res.status(200).json(new ApiResponse(200, savedUser, `User details of ${savedUser.employeeId} updated successfully.`));
    }
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while updating user details."));
  }
}

const getAssessmentScoresForTraineeByBatch = async (req, res) => {
  try {
    let { batchId, employeeId } = req.params;
    let query = {}
    if (batchId) {
      let batch = await prisma.batch.findUnique({ where: { id: BigInt(batchId) } });
      if (!batch) {
        return res.status(400).json(new ApiResponse(400, {}, "Batch id does not exist in system."));
      }
      query = { user: { batches: { every: { batchId: batch.id } } } };
    }
    let user = await prisma.user.findUnique({ where: { employeeId: String(employeeId) } });
    query = { ...query, userId: user.id, }
    let data = await prisma.userAssessment.findMany({
      where: query,
      include: { assessment: { include: { module: true } } }
    });
    if (data.length) {
      data = data.map(value => { return { ...value.assessment, marksObtained: value.marksObtained } });
    }
    return res.status(200).json(new ApiResponse(200, data, "Assessment details fetched successfully."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching assessments."));
  }
}

const addLocation = async (req, res) => {
  let { location } = req.body;
  try {
    if (location) {
      let locationRecord = await prisma.location.findUnique({ where: { name: location } });
      if (locationRecord) {
        logger.warn(`Location ${location} is already present in the system.`);
        return res.status(400).json(new ApiResponse(400, {}, `Location ${location} is already present in the system.`));
      }
      locationRecord = await prisma.location.create({ data: { name: location } });
      logger.warn(`Location: ${location} added successfully.`);
      return res.status(200).json(new ApiResponse(200, locationRecord, `Location: ${location} added successfully.`));
    }
    return res.status(400).json(new ApiResponse(400, {}, "Location is not present."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding new location."));
  }
}

const addModules = async (req, res) => {
  try {
    let { modules } = req.body;
    let result = await prisma.module.findMany({ where: { moduleName: { in: modules } } });
    if (result.length == modules.length) {
      return res.status(400).json(new ApiResponse(400, {}, "Please enter one or more unique modules."));
    }
    if (result.length) {
      let names = result.map(module => module.moduleName);
      modules = modules.filter(module => !names.includes(module));
    }
    let modulesToBeSaved = modules.map(module => { return { moduleName: module } });
    let savedModules = await prisma.module.createMany({ data: modulesToBeSaved });
    logger.info(`${modules.join(",")} Module(s) saved successfully.`);
    return res.status(200).json(new ApiResponse(200, savedModules, `${modules.join(",")} Module(s) saved successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding new module(s)."));
  }
}

const addTraining = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    let { trainingName, duration, modules } = req.body;
    const foundModules = await prisma.module.findMany({
      where: { moduleName: { in: modules, }, },
      select: { id: true }
    });
    const training = await prisma.training.create({
      data: {
        trainingName, duration: parseInt(duration),
        modules: { create: foundModules.map(module => ({ moduleId: module.id })) }
      }
    });
    logger.info(`Training: [${training.trainingName}] added by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, training, `Training: [${training.trainingName}] added successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding new training."));
  }
}

const assignTraining = async (req, res) => {
  try {
    let { trainingId, userIds } = req.body;
    if (!trainingId) {
      logger.warn("TrainingId is empty.");
      return res.status(400).json(new ApiResponse(400, {}, "TrainingId is empty."));
    }
    let training = await prisma.training.findUnique({
      where: { id: BigInt(trainingId) },
      select: { id: true, trainingName: true }
    });
    if (!userIds?.length) {
      logger.warn("UserIds is empty.");
      return res.status(400).json(new ApiResponse(400, {}, "UserIds are empty."));
    }
    userIds = userIds.map(id => BigInt(id));
    let presentInDb = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, employeeId: true }
    });
    if (presentInDb.length !== userIds?.length) {
      let ids = presentInDb.map(user => user.id);
      let absentIds = userIds.filter(id => ids.includes(BigInt(id)));
      logger.warn(`${absentIds.join(",")} are not present in system`);
      return res.status(400).json(new ApiResponse(400, {}, `${absentIds.join(",")} are not present in system`));
    }

    let userTrainings = await prisma.userTraining.findMany({
      where: { userId: { in: userIds }, trainingId: BigInt(trainingId) },
      select: { userId: true }
    });
    let presentUserIds = userTrainings.map(user => user.userId);
    if (presentUserIds.length) {
      presentInDb = presentInDb.filter(user => presentUserIds.includes(user.id));
      presentInDb = presentInDb.map(user => user.employeeId);
      logger.warn(`${presentInDb.join(",")} are already assigned with training: [${training.trainingName}].`);
      return res.status(400).json(new ApiResponse(400, {}, `User(s): [${presentInDb.join(", ")}] are already assigned with training: [${training.trainingName}].`));
    }

    let dataToInsert = userIds.map(id => {
      return {
        userId: BigInt(id),
        trainingId: BigInt(trainingId),
        assignedDate: new Date(),
      }
    });
    let result = await prisma.userTraining.createMany({ data: dataToInsert });
    let employeeIds = presentInDb.map(user => user.employeeId);
    logger.audit(`[${employeeIds.join(", ")}] are assigned with training [${training.trainingName}] by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, result, `Users: [${employeeIds.join(", ")}] are assigned with training: [${training.trainingName}].`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while assigning training."));
  }
}

const updateTraining = async (req, res) => {
  let { trainingId } = req.params;
  let { trainingName, duration, modules } = req.body;

  try {
    // Fetch the training details
    let training = await prisma.training.findUnique({
      where: { id: BigInt(trainingId) },
      include: { modules: true }
    });

    if (!training) {
      return res.status(400).json(new ApiResponse(400, {}, `Training with id [${trainingId}] does not exist in system.`));
    }

    // Fetch the modules that are part of the training
    let foundModules = await prisma.module.findMany({
      where: { moduleName: { in: modules } },
      select: { id: true }
    });

    let currentModuleIds = training.modules.map(module => module.moduleId);

    let newModuleIds = foundModules.map(module => module.id);

    let modulesToRemove = currentModuleIds.filter(id => !newModuleIds.includes(id));

    let modulesToAdd = newModuleIds.filter(id => !currentModuleIds.includes(id));
    let updatedTraining = await prisma.$transaction(async tx => {
      let updatedTraining = await tx.training.update({
        where: { id: BigInt(trainingId) },
        data: {
          trainingName, duration: parseInt(duration),
          modules: {
            deleteMany: { moduleId: { in: modulesToRemove } },
            create: modulesToAdd.map(moduleId => ({ moduleId: moduleId }))
          }
        },
        include: { modules: true }
      });
      return updatedTraining;
    });

    logger.audit(`Training: [${training.trainingName}] updated by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}).`);
    return res.status(200).json(new ApiResponse(200, updatedTraining, `Training: [${training.trainingName}] updated successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while updating training."));
  }
};

const removeTrainingOfUser = async (req, res) => {
  try {
    let { userId } = req.params;
    let { userTrainingId } = req.body;
    let user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }
    let userTraining = await prisma.userTraining.findFirst({
      where: { userId: user.id, id: BigInt(userTrainingId) },
      include: { training: true }
    });
    if (!userTraining) {
      return res.status(404).json(new ApiResponse(404, {}, "User training not found."));
    }
    await prisma.userTraining.delete({ where: { id: BigInt(userTrainingId) } });
    logger.audit(`Training: ${userTraining.training.trainingName} removed from user ${user.employeeId} by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `Training: ${userTraining.training.trainingName} removed from user ${user.employeeId} successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while removing training from user."));
  }
}

const removeUserFromBatch = async (req, res) => {
  try {
    let { userId } = req.params;
    let { batchId } = req.body;
    let user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }
    let userBatch = await prisma.userBatch.findFirst({
      where: { userId: user.id, batchId: BigInt(batchId) },
      include: { batch: true }
    });
    if (!userBatch) {
      return res.status(404).json(new ApiResponse(404, {}, "User batch not found."));
    }
    await prisma.userBatch.delete({ where: { userId_batchId: { userId: user.id, batchId: BigInt(batchId) } } });
    logger.audit(`User: ${user.employeeId} removed from batch ${userBatch.batch.batchName} by ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId})`);
    return res.status(200).json(new ApiResponse(200, {}, `User: ${user.employeeId} removed from batch ${userBatch.batch.batchName} successfully.`));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while removing user from batch."));

  }
}

const getTrainingDetails = async (req, res) => {
  try {
    let { trainingId } = req.params;
    let training = await prisma.training.findUnique({
      where: { id: BigInt(trainingId) },
      include: {
        modules: { select: { module: true } }
      }
    });
    if (training) {
      return res.status(200).json(new ApiResponse(200, training));
    }
    return res.status(404).json(new ApiResponse(404, {}, "Training not found."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching training details."));
  }
}

const getTrainingsOfUser = async (req, res) => {
  try {
    let { employeeId } = req.params;
    let user = await prisma.user.findUnique({
      where: { employeeId: String(employeeId) },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }
    let trainings = await prisma.userTraining.findMany({
      where: { userId: user.id },
      include: { training: true }
    });
    if (trainings.length) {
      return res.status(200).json(new ApiResponse(200, trainings));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No training found."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching trainings."));
  }
}

const getBatchesOfUser = async (req, res) => {
  try {
    let { employeeId } = req.params;
    let user = await prisma.user.findUnique({
      where: { employeeId: String(employeeId) },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }
    let batches = await prisma.userBatch.findMany({
      where: { userId: user.id },
      include: { batch: true }
    });
    if (batches.length) {
      return res.status(200).json(new ApiResponse(200, batches));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No batch found."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching batches."));
  }
}

export {
  addBatchForExistingUser, addBulkTestDataofUsers, addLocation, addModules, addRemark, addSingleAssessmentDetails, addTraining, addUser, allUsers, assignTraining, bulkUsersFromFile, deleteAssessment, deleteBatch, deleteLocation, deleteModules,
  deleteTraining, deleteUser, deleteUsers, getAllBatches, getAllBatchesIncludingInactive, getAllModules, getAllRoles, getAllTrainees, getAllTraineesByLocationsAndNotInBatch, getAllTrainings, getAssessmentDetails, getAssessmentScoresForTraineeByBatch,
  getAssessmentsDetailsForSpecificBatch, getAssessmentsForSpecificBatch, getBatch, getBatchesOfUser, getLocations, getTraineeDetails, getTrainingDetails,
  getTrainingsOfUser, getUserDetails, removeTrainingOfUser, removeUserFromBatch, resetPassword, setBatchInactive, toggleUserIsActive, updateTraining, updateUserDetails
};

