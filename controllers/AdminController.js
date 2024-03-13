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

const addUsers = async (incomingUsers, session) => {
    if (!validateIncomingUsers(incomingUsers)) {
        return false;
    }
    else {
        let usersToBeSaved = await incomingUsers.map((incomingUser) => {
            delete incomingUser.Name;
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

            var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
            const excelData = await readExcelFile(filePath, ["Users"]);
            session.startTransaction();
            let { insertedcount, insertedIds } = await addUsers(excelData.Users, session);
            fs.remove(filePath);
            let { batchName, location } = req.body;
            if (!insertedcount) {
                return res.status(500).json(new ApiResponse(500, {}, "Users not saved"));
            }
            console.log(Object.values(insertedIds));
            let trainees = Object.values(insertedIds);
            let batch = new Batch({ batchName: batchName, location: location, isLatest: true, trainees: trainees });
            await batch.save(session);
            let oldBatch = await Batch.findOneAndUpdate({ location: location, isLatest: true }, { isLatest: false }, { new: true }).session(session);
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
                return res.status(400).json(new ApiResponse(400, {}, missingIds.join(",") + " users not present in system"));
            }
            else {
                
                session.startTransaction();
                let assessment = new Assessment(
                    {
                        moduleName: req.body.moduleName,
                        date: req.body.date,
                        totalMarks: req.body.totalMarks
                    }
                );
                await assessment.save(session);
                await excelData.Sheet1.map(async object => {
                    let user = await User.findOne({ employeeId: object.employeeId });
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

const allUsers = async (req, res, next)=>{
    let users;
    try{
        let {location} = req.params;
        users = await User.find({role: "Trainee", isActive: true, location:location}).select("-password -refreshToken -isActive");
        return res.status(200).json(new ApiResponse(200, users));
    }catch(e){
        return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
    }
}

const getAllBatches = async(req, res)=>{
    try {
        let batches = await Batch.find({});
        return res.status(200).json(new ApiResponse(200, batches));
    } catch (error) {
        console.log(error);
        return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
    }
}

export {
    bulkUsersFromFile,
    addBulkTestDataofUsers,
    allUsers,
    getAllBatches
};
