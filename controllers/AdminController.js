import excelToJson from "convert-excel-to-json";
import * as fs from 'fs-extra';
import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.js";


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
        let result = await User.bulkSave(usersToBeSaved,  {timestamps:false, session: session});
        return result.insertedCount;
    }
}

const bulkUsersFromFile = async (req, res, next) => {
    try {
        if (req.file?.filename == null || req.file?.filename == undefined) {
            res.status(400).json("No file is sent");
        }
        else {
            var filePath = process.env.FILE_UPLOAD_LOCATION + req.file.filename;

            const excelData = excelToJson({
                sourceFile: filePath,
                header: {
                    rows: 1,
                },
                columnToKey: {
                    "*": "{{columnHeader}}",
                },
                sheets: ["Users"]
            });
            let result = await addUsers(excelData.Users);
            fs.remove(filePath);

            if (!result) {
                res.status(500).json(new ApiResponse(500, {}, "Users not saved"));
            }
            res.status(200).json(new ApiResponse(200, result + " Users saved", "User uploading is finished"));
        }
    }
    catch (e) {
        res.status(500).json(new ApiResponse(500, {}, "Internal server error"));
    }
}

export {
    bulkUsersFromFile
}