import excelToJson from "convert-excel-to-json";
import * as fs from 'fs-extra';
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.js";
import { UserAssessment } from "../models/UserAssessment.js";
import { Assessment } from "../models/Assessment.js";


const readExcelFile = async (filePath, sheetName)=>{
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

const addUsers = async (incomingUsers) => {
    if (!validateIncomingUsers(incomingUsers)) {
        return false;
    }
    else {
        let session = await mongoose.startSession();
        let usersToBeSaved = await incomingUsers.map((incomingUser) => {
            delete incomingUser.Name;
            return new User(incomingUser);
        });
        let result = await User.bulkSave(usersToBeSaved, { timestamps: false, session: session });
        return result.insertedCount;
    }
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
            const excelData = await readExcelFile(filePath, ["Users"]);
            let result = await addUsers(excelData.Users);
            fs.remove(filePath);

            if (!result) {
                return res.status(500).json(new ApiResponse(500, {}, "Users not saved"));
            }
            return res.status(200).json(new ApiResponse(200, result + " Users saved", "User uploading is finished"));
        }
    }
    catch (e) {
        res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
    }
}

const addBulkTestDataofUsers = async(req, res, next) => {
    try {
        if (req.file?.filename == null || req.file?.filename == undefined) {
            return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
        }
        else{
            var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;
            const excelData = await readExcelFile(filePath, ["Sheet1"]);
            let employeeIds = excelData.Sheet1.map(({employeeId})=>employeeId);
            console.log("emp ids:",employeeIds);
            let presentIds= await User.distinct("employeeId",{employeeId: {$in: employeeIds} });
            let missingIds = employeeIds.filter(id => !presentIds.includes(id));
            console.log("Missing Ids:",missingIds);
            if(missingIds.length){
                return res.status(400).json(new ApiResponse(400, {}, missingIds.join(",")+ " users not present in system"));
            }
            else{
                let session = await mongoose.startSession();
                session.startTransaction();
                let assessment = new Assessment(
                    {
                        moduleName: req.body.moduleName,
                        date : req.body.date,
                        totalMarks: req.body.totalMarks
                    }
                );
                await assessment.save(session);
                await excelData.Sheet1.map(async object=>{
                    let user = await User.findOne({employeeId: object.employeeId});
                    let userAssessment = new UserAssessment(
                        {
                            userRef : user._id,
                            assessmentRef : assessment._id,
                            marksObtained : object.marks
                        }
                    );
                    await userAssessment.save(session);
                });
                session.commitTransaction();
                return res.status(200).json(new ApiResponse(200, assessment, "Assessment details are saved.")); 
            }
        }
    } 
    catch (e) {
        console.log(e);
        res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
    }
}

export {
    bulkUsersFromFile,
    addBulkTestDataofUsers
}