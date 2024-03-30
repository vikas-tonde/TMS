import excelToJson from "convert-excel-to-json";
import { validationResult } from 'express-validator';
import * as fs from 'fs-extra';
import mongoose from "mongoose";
import { Assessment } from "../models/Assessment.js";
import { Batch } from "../models/Batch.js";
import { User } from "../models/User.js";
import { UserAssessment } from "../models/UserAssessment.js";
import { ApiResponse } from "../utils/ApiResponse.js";


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
                        quizName: req.body.quizName,
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

export {
    bulkUsersFromFile,
    addBulkTestDataofUsers,
    allUsers,
    getAllBatches,
    getAllModules,
    getAllTrainees
};
