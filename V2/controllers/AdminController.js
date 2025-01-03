import bcrypt from 'bcryptjs';
import excelToJson from "convert-excel-to-json";
import { validationResult } from 'express-validator';
import * as fs from 'fs-extra';
import prisma from '../../DB/db.config.js';
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Prisma } from '@prisma/client';

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
      return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
    }
    else {
      var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
      const excelData = await readExcelFile(filePath, ["Sheet1"]);
      let users = excelData.Sheet1;
      if (!validateIncomingUsers(users)) {
        return res.status(400).json(new ApiResponse(400, {}, "All fields not present for all users"));
      }
      const userBatches = [];
      let timeout = users.length * 1000;
      await prisma.$transaction(async tx => {
        let { batchName, location } = req.body;
        let locationRecord = await tx.location.findFirst({
          where: {
            name: location
          }
        });
        if (!locationRecord) {
          locationRecord = await tx.location.create({
            data: {
              name: location
            }
          });
        }
        let oldBatch = await tx.batch.updateMany({
          data: {
            isLatest: false
          },
          where: {
            locationId: locationRecord.id,
            isLatest: true,
          },
        });

        let newBatch = await tx.batch.create({
          data: {
            batchName: batchName,
            locationId: locationRecord.id
          }
        });
        let usersToBeSaved = [];
        let usersAlreadyPresent = [];
        let role = await tx.role.findFirst({
          where: {
            name: "Trainee"
          }
        });

        for (let user of users) {
          let userAlreadyPresnt = await tx.user.findFirst({
            where: {
              email: user.email,
              employeeId: user.employeeId
            }
          });
          if (userAlreadyPresnt) {
            usersAlreadyPresent.push(userAlreadyPresnt);
          }
          else {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
            user.userRole = role.id;
            user.locationId = locationRecord.id
            usersToBeSaved.push(user);
          }
        }
        let savedUsers = [];
        if (usersToBeSaved.length) {
          savedUsers = await tx.user.createManyAndReturn({
            data: usersToBeSaved
          });
        }

        users = [...savedUsers, ...usersAlreadyPresent];
        for (const user of users) {
          userBatches.push({
            userId: user.id,
            batchId: newBatch.id,
          });
        }
        if (userBatches.length) {
          await tx.userBatch.createMany({
            data: userBatches
          });
        }
        return userBatches;
      },
        {
          timeout
        }
      );
      fs.remove(filePath);
      return res.status(200).json(new ApiResponse(200, userBatches.length + " Users saved", "User uploading is finished"));
    }
  }
  catch (e) {
    console.log(e);
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
      return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
    }
    else {
      var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
      const excelData = await readExcelFile(filePath, ["Sheet1"]);
      let { batchId } = req.body;
      let employeeIds = excelData.Sheet1.map(({ employeeId }) => employeeId);
      let batch = await prisma.batch.findUnique({
        where: { id: BigInt(batchId) }
      });
      let presentIdsSystem = await prisma.user.findMany({
        where: {
          employeeId: { in: employeeIds },
        },
        select: { employeeId: true }
      });
      let missingIdsSystem = employeeIds.filter(id => !presentIdsSystem.some(obj => obj.employeeId === id));

      if (missingIdsSystem.length) {
        return res.status(400).json(new ApiResponse(400, {}, missingIdsSystem.join(",") + " users are not present in system."));
      }
      let presentIdsBatch = await prisma.user.findMany({
        where: {
          batches: { some: { batchId: batch.id } },
        },
        select: { employeeId: true }
      });
      let missingIdsBatch = employeeIds.filter(id => !presentIdsBatch.some(obj => obj.employeeId === id));
      if (missingIdsBatch.length) {
        return res.status(400).json(new ApiResponse(400, {}, missingIdsBatch.join(",") + " users are not present in Batch."));
      }
      const timeout = employeeIds.length * 1000;
      let assessment = await prisma.$transaction(async tx => {
        let module = await tx.module.findFirst({
          where: {
            moduleName: req.body.moduleName
          }
        });
        if (!module) {
          module = await tx.module.create({
            data: { moduleName: req.body.moduleName }
          });
        }
        let users = [];
        for (const object of excelData.Sheet1) {
          let user = await tx.user.findUnique({
            where: { employeeId: object.employeeId },
            select: {
              id: true,
              employeeId: true,
            }
          });
          users.push({ userId: user.id, marksObtained: object.marks })
        }
        let stringDate = req.body.date;
        let dateArray = stringDate.split("-");
        let date = new Date(Date.UTC(parseInt(dateArray[2]), parseInt(dateArray[0]) - 1, parseInt(dateArray[1])));
        const assessment = await tx.assessment.create({
          data: {
            assessmentName: req.body.assessmentName,
            date: date,
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
      return res.status(200).json(new ApiResponse(200, assessment, "Assessment details are saved."));

    }
  }
  catch (e) {
    console.log(e);
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
      return res.status(400).json(new ApiResponse(400, {}, "Wrong location sent..."));
    }

    let clause = Prisma.sql`b."id" = ${batchId} AND b."locationId" = ${locationRecord.id}`;
    if (!batchId) {
      clause = Prisma.sql`b."locationId" = ${locationRecord.id} AND b."isLatest" = true`;
    }
    const result = await prisma.$queryRaw`
      SELECT u."employeeId", u.id::text, u."firstName", u."lastName", u.email, u."profileImage", 
        ((sum(ua."marksObtained")::float / sum(a."totalMarks")::float) * 100) as percentage
      FROM public."User" u
      JOIN public."UserBatch" ub ON u.id = ub."userId"
      JOIN public."Batch" b ON b.id = ub."batchId"
      JOIN public."UserAssessment" ua ON u.id = ua."userId"
      JOIN public."Assessment" a ON a.id = ua."assessmentId" 
      WHERE ${clause}
      GROUP BY u.id ORDER BY percentage desc;
      `;
    if (result.length) {
      return res.status(200).json(new ApiResponse(200, result));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No records found"));
  } catch (e) {
    console.log(e);
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
          remarks: true,
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
      console.log(userWithAssessments);
      // Calculate percentage
      let percentage = 0;
      if (totalMarks) {
        percentage = (totalMarksObtained / totalMarks) * 100;
      }
      userWithAssessments.percentage = percentage;
      if (userWithAssessments) {
        return res.status(200).json(new ApiResponse(200, userWithAssessments));
      }
      return res.status(404).json(new ApiResponse(404, {}, `No trainee found for employeeId ${employeeId}`));
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const addRemark = async (req, res) => {
  let { employeeId, remark } = req.body;

  if (!(employeeId && remark)) {
    return res.status(400).json(new ApiResponse(400, {}, "employeeId and remark is not sent."));
  }
  try {
    let date = new Date();
    let foundUser = await prisma.$transaction(async tx => {
      return await tx.user.update({
        where: { employeeId: employeeId },
        data: {
          remarks: { create: { value: remark, date: date } }
        },
        include:{
          remarks:true,
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
      return res.status(404).json(new ApiResponse(404, {}, `Employee not found with ${employeeId}`));
    }
    return res.status(200).json(new ApiResponse(200, foundUser));
  } catch (e) {
    console.log(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllBatches = async (req, res) => {
  try {
    let { location } = req.params;
    let query = {};
    if (location) {
      let locationRecord = await prisma.location.findFirst({ where: { name: location } });
      if (!locationRecord) {
        return res.status(404).json(new ApiResponse(404, {}, `Location you have sent doesn't exist in database.`));
      }
      query = { locationId: locationRecord.id };
    }
    let batches = await prisma.batch.findMany({ where: { ...query } });
    if (batches?.length) {
      return res.status(200).json(new ApiResponse(200, batches));
    }
    return res.status(404).json(new ApiResponse(404, {}, `No batches found for location ${location}`));
  } catch (error) {
    console.log(error);
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
    console.log(error);
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
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllTrainees = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    let trainees = await prisma.user.findMany({
      where: {
        batches: {
          some: { batchId: batchId }
        }
      },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true
      }
    });
    if (trainees.length) {
      return res.status(200).json(new ApiResponse(200, trainees));
    }
    return res.status(200).json(new ApiResponse(200, {}, "No trainees found"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const addUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  } else {
    try {
      const { firstName, lastName, email, password, employeeId, locationId, batchId, roleId } = req.body;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      let user = await prisma.$transaction(async tx => {
        return await tx.user.create({
          data: {
            firstName, lastName, employeeId, email,
            password: hashedPassword,
            location: { connect: locationId },
            batches: { connect: batchId },
            role: { connect: roleId }
          }
        });
      });
      if (user) {
        return res.status(200).json(new ApiResponse(200, user, "User registered successfully."));
      }
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong, user registration failed."));

    }
    catch (e) {
      console.log(e);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while registering the user."));
    }
  }
}

const setUserInactive = async (req, res) => {
  console.log();

  let { userIds, isActive } = req.body;
  if (userIds?.length > 0) {
    try {
      let count = await prisma.$transaction(async tx => {
        let { count } = await tx.user.updateMany({
          where: {
            employeeId: { in: userIds }
          },
          data: {
            isActive: isActive || false
          }
        });
        return count;
      });
      return res.status(200).json(new ApiResponse(200, {}, "user(s) have been set to inactive."));
    } catch (error) {
      session.abortTransaction();
      console.log(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while setting user inactive."));
    }
  }
  else {
    return res.status(400).json(new ApiResponse(400, {}, "User Id is not provided."));
  }
}
const setBatchInactive = async (req, res) => {
  console.log();

  let { batchId, isActive } = req.body;
  if (userIds?.length > 0) {
    try {
      let batch = await prisma.$transaction(async tx => {
        return await tx.batch.update({
          where: {
            id: batchId
          },
          data: {
            isActive: isActive || false
          }
        });
        return count;
      });
      return res.status(200).json(new ApiResponse(200, {}, "user(s) have been set to inactive."));
    } catch (error) {
      session.abortTransaction();
      console.log(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while setting user inactive."));
    }
  }
  else {
    return res.status(400).json(new ApiResponse(400, {}, "User Id is not provided."));
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
      }
    });
    return res.status(200).json(new ApiResponse(200, assessments, "Assessments fetched successfully"));
  } catch (error) {
    console.log(error);
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
            id: batchId,
          },
        },
      },
    });
    return res.status(200).json(new ApiResponse(200, assessments, "Assessments fetched successfully"));
  } catch (error) {
    console.log(error);
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
        return res.status(404).json(new ApiResponse(500, {}, `There is no user with employee id ${employeeId}.`));
      }
      let assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } })
      if (!assessment) {
        return res.status(404).json(new ApiResponse(500, {}, `There is no assessment with id ${assessmentId}.`));
      }
      let userAssessment = await prisma.userAssessment.findUnique({
        where: { userId: user.id, assessmentId: assessmentId }
      });

      if (!userAssessment) {
        userAssessment = await prisma.userAssessment.create({
          data: { userId: user.id, assessmentId: assessmentId }
        });
        operation = "added";
      }
      else {
        userAssessment = await prisma.userAssessment.update({
          data: { marksObtained: obtainedMarks },
          where: { userId: user.id, assessmentId: assessmentId }
        });
      }
      return res.status(200).json(new ApiResponse(200, {}, `Exam details ${operation} successfully for employee id: ${employeeId}`));
    } catch (error) {
      console.log(error);
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
    console.log(e);
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
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching locations."));
  }
}

// const addLocation = async (req, res) => {
//   let { location } = req.body;
//   try {
//     if (location) {
//     }
//   } catch (error) {

//   }
// }

export {
  addUser,
  getBatch,
  allUsers,
  addRemark,
  getLocations,
  getAllModules,
  getAllBatches,
  getAllTrainees,
  setUserInactive,
  setBatchInactive,
  getTraineeDetails,
  bulkUsersFromFile,
  getAssessmentDetails,
  addBulkTestDataofUsers,
  addSingleAssessmentDetails,
  getAssessmentsForSpecificBatch,
  getAssessmentsDetailsForSpecificBatch,
};
