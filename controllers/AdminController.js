import excelToJson from "convert-excel-to-json";
import { validationResult } from 'express-validator';
import * as fs from 'fs-extra';
import mongoose from "mongoose";
import { Assessment } from "../models/Assessment.js";
import { Batch } from "../models/Batch.js";
import { User } from "../models/User.js";
import { UserAssessment } from "../models/UserAssessment.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import bcrypt from 'bcryptjs'

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
    if (!(incomingUser?.firstName && incomingUser?.lastName && incomingUser?.email && incomingUser?.password &&
      incomingUser?.role && incomingUser?.employeeId && incomingUser?.location)) {
      return false;
    }
  }
  return true;
}

const addUsers = async (incomingUsers, session, batchId) => {
  if (!validateIncomingUsers(incomingUsers)) {
    return false;
  }
  else {
    let usersToBeSaved = await incomingUsers.map((incomingUser) => {
      delete incomingUser.Name;
      incomingUser.batch = batchId;
      return new User(incomingUser);
    });
    let result = await User.bulkSave(usersToBeSaved, { timestamps: false, session: session });
    let insertedcount = result.insertedCount;
    let insertedIds = result.insertedIds;
    return { insertedcount, insertedIds };
  }
}

const bulkUsersFromFile = async (req, res, next) => {
  let session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (req.file?.filename == null || req.file?.filename == undefined) {
      return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
    }
    else {
      session.startTransaction();
      var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
      const excelData = await readExcelFile(filePath, ["Users"]);
      let { batchName, location } = req.body;
      let batch = new Batch({ batchName: batchName, location: location, isLatest: true });
      let { insertedcount, insertedIds } = await addUsers(excelData.Users, session, batch._id);
      fs.remove(filePath);
      if (!insertedcount) {
        return res.status(500).json(new ApiResponse(500, {}, "Users not saved"));
      }
      console.log(Object.values(insertedIds));
      let trainees = Object.values(insertedIds);
      batch.trainees = trainees;
      let oldBatch = await Batch.findOneAndUpdate({ location: location, isLatest: true }, { isLatest: false }, { new: true }).session(session);
      await batch.save(session);
      session.commitTransaction();
      return res.status(200).json(new ApiResponse(200, insertedcount + " Users saved", "User uploading is finished"));
    }
  }
  catch (e) {
    session.abortTransaction();
    console.log(e);
    res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
  }
}

const addBulkTestDataofUsers = async (req, res, next) => {
  let session = await mongoose.startSession();
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
      let employeeIds = excelData.Sheet1.map(({ employeeId }) => employeeId);
      let presentIds = await User.distinct("employeeId", { employeeId: { $in: employeeIds } });
      let missingIds = employeeIds.filter(id => !presentIds.includes(id));
      if (missingIds.length) {
        return res.status(400).json(new ApiResponse(400, {}, missingIds.join(",") + " users are not present in system"));
      }
      else {
        session.startTransaction();
        let assessment = new Assessment(
          {
            moduleName: req.body.moduleName,
            assessmentName: req.body.assessmentName,
            date: req.body.date,
            totalMarks: req.body.totalMarks,
            assessmentType: req.body.assessmentType
          }
        );
        await assessment.save(session);
        let batchId;
        await excelData.Sheet1.map(async object => {
          let user = await User.findOne({ employeeId: object.employeeId });
          if (batchId !== user.batch) {
            batchId = user.batch;
            let batch = await Batch.findById(batchId);
            if (!batch.assessments.includes(assessment._id)) {
              batch.assessments.push(assessment._id);
              batch.save(session);
            }
          }
          let userAssessment = new UserAssessment(
            {
              userRef: user._id,
              assessmentRef: assessment._id,
              marksObtained: object.marks
            }
          );
          await userAssessment.save(session);
        });
        session.commitTransaction();
        fs.remove(filePath);
        return res.status(200).json(new ApiResponse(200, assessment, "Assessment details are saved."));
      }
    }
  }
  catch (e) {
    session.abortTransaction()
    console.log(e);
    res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
  }
}

const allUsers = async (req, res, next) => {
  let users;
  try {
    let { location, batchName } = req.params;
    let query = { batchName: batchName, location: location };
    if (!batchName) {
      query = { location: location, isLatest: true };
    }
    let batch = await Batch.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "User",
          localField: "trainees",
          foreignField: "_id",
          as: "trainees",
          pipeline: [
            {
              $lookup: {
                from: "UsersAssessments",
                localField: "_id",
                foreignField: "userRef",
                as: "Exams",
                pipeline: [
                  {
                    $group: {
                      _id: "$userRef",
                      averageMarks: {
                        $avg: "$marksObtained",
                      },
                      assessments: {
                        $push: "$assessmentRef",
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "Assessments",
                      localField: "assessments",
                      foreignField: "_id",
                      as: "assessments",
                    },
                  },
                  {
                    $addFields: {
                      total: {
                        $sum: { $sum: "$assessments.totalMarks" },
                      },
                    }
                  },
                  {
                    $addFields: {
                      percentage: {
                        $multiply: [{ $divide: ["$averageMarks", "$total"] }, 100]
                      }
                    },
                  },
                ]
              },
            },
          ]
        }
      },
      {
        $project: {
          password: 0,
          refreshToken: 0,
          isActive: 0
        }
      }
    ]);
    users = batch[0].trainees;
    return res.status(200).json(new ApiResponse(200, users));
  } catch (e) {
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllBatches = async (req, res) => {
  try {
    let batches = await Batch.find({}).select("-isLatest -isActive");
    return res.status(200).json(new ApiResponse(200, batches));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getBatch = async (req, res) => {
  let { batchId } = req.params;
  try {
    let batch = await Batch.findOne({ _id: batchId });
    return res.status(200).json(new ApiResponse(200, batch));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, `Unable to find the batch with ID :${req.params.batchId}`));
  }
}

const getAllModules = async (req, res) => {
  try {
    let moduleNames = await Assessment.distinct("moduleName");
    return res.status(200).json(new ApiResponse(200, moduleNames));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getAllTrainees = async (req, res) => {
  try {
    let trainees = await User.find({ batch: req.params.batchId }).select("-password -refreshToken -isActive -profileImage -role");
    return res.status(200).json(new ApiResponse(200, trainees));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const addUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  } else {
    let session = await mongoose.startSession();
    try {
      const userFromReq = req.body;
      const salt = await bcrypt.genSalt(10);
      const { firstName, lastName, email, password, employeeId, location, batchId, role } = userFromReq;
      const hashedPassword = await bcrypt.hash(password, salt);

      session.startTransaction();
      const user = new User({ firstName: firstName, lastName: lastName, email: email, password: hashedPassword, employeeId: employeeId, location: location, role: role });
      let batch = await Batch.findById(batchId);
      batch.trainees.push(user._id);
      await batch.save(session);
      user.batch = batch._id;
      await user.save(session)
      session.commitTransaction();
      return res.status(200).json(new ApiResponse(200, user, "User registered successfully"));
    }
    catch (e) {
      session.abortTransaction()
      console.log(e);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while registering the user."));
    }
  }
}

const getAssessmentsForSpecificBatch = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    let batch = await Batch.findById(batchId);
    let assessmentType = req.params.assessmentType;
    let assessments = await Assessment.find({ _id: { $in: batch.assessments }, assessmentType: assessmentType }).select("moduleName assessmentName");
    return res.status(200).json(new ApiResponse(200, assessments, "Assessments fetched successfully"));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while fetching Assessments."));
  }
}

const getAssessmentsDetailsForSpecificBatch = async (req, res) => {
  try {
    let batchId = req.params.batchId;
    let batch = await Batch.findById(batchId);
    let assessments = await Assessment.find({ _id: { $in: batch.assessments } });
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
    let session = await mongoose.startSession();
    try {
      let operation = "updated";
      let { assessmentId, employeeId, obtainedMarks } = req.body;
      session.startTransaction();
      let user = await User.findOne({ employeeId: employeeId });
      if (!user) {
        return res.status(404).json(new ApiResponse(500, {}, `There is no user with employee id ${employeeId}.`));
      }
      let userAssessment = await UserAssessment.findOne({ userRef: user._id, assessmentRef: assessmentId });
      if (!userAssessment) {
        let assessment = Assessment.findById(assessmentId);
        if (!assessment) {
          session.abortTransaction();
          return res.status(404).json(new ApiResponse(500, {}, `There is no assessment with id ${assessmentId}.`));
        }
        userAssessment = new UserAssessment({ userRef: user._id, assessmentRef: assessmentId, marksObtained: obtainedMarks });
        operation = "added";
      }
      else {
        userAssessment.marksObtained = obtainedMarks;
      }
      userAssessment.save(session);
      session.commitTransaction();
      return res.status(200).json(new ApiResponse(200, {}, `Exam details ${operation} successfully for employee id: ${employeeId}`));
    } catch (error) {
      session.abortTransaction();
      console.log(error);
      return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding exam details."));
    }
  }
}

const getAssessmentDetails = async (req, res) => {
  let details;
  try {
    let { assessmentId } = req.params;
    details = await Assessment.aggregate([
      { $match: { _id: (new mongoose.Types.ObjectId(assessmentId)) } },
      {
        $lookup: {
          from: "UsersAssessments",
          localField: "_id",
          foreignField: "assessmentRef",
          as: "candidates"
        }
      },
      {
        $lookup: {
          from: "User",
          let: {
            candidateIds: "$candidates.userRef"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$candidateIds"]
                }
              }
            }
          ],
          as: "candidateDetails"
        }
      },
      {
        $project: {
          _id: 1,
          assessmentName: 1,
          moduleName: 1,
          assessmentType: 1,
          totalMarks: 1,
          date: 1,
          candidates: {
            $map: {
              input: "$candidates",
              as: "candidate",
              in: {
                $mergeObjects: [
                  "$$candidate", // Existing fields in "candidates"
                  {
                    details: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input:
                              "$candidateDetails",
                            as: "detail",
                            cond: {
                              $eq: [
                                "$$detail._id",
                                "$$candidate.userRef"
                              ]
                            }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          assessmentName: 1,
          totalMarks: 1,
          moduleName: 1,
          date: 1,
          candidates: {
            $map: {
              input: "$candidates",
              as: "candidate",
              in: {
                score: "$$candidate.marksObtained",
                firstName: "$$candidate.details.firstName",
                lastName: "$$candidate.details.lastName",
                email: "$$candidate.details.email",
                employeeId: "$$candidate.details.employeeId"
              }
            }
          }
        }
      }
    ]);
    if (details.length > 0) {
      return res.status(200).json(new ApiResponse(200, details[0], `${details.length} records found`));
    }
    else{
      return res.status(200).json(new ApiResponse(200, {}, `No data found`));
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }

}

export {
  bulkUsersFromFile,
  addBulkTestDataofUsers,
  allUsers,
  getAllBatches,
  getBatch,
  getAllModules,
  getAllTrainees,
  addUser,
  getAssessmentsForSpecificBatch,
  getAssessmentsDetailsForSpecificBatch,
  getAssessmentDetails,
  addSingleAssessmentDetails,
};
