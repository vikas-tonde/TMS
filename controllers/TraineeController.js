import excelToJson from "convert-excel-to-json";
import { validationResult } from 'express-validator';
import * as fs from 'fs-extra';
import mongoose from "mongoose";
import { Assessment } from "../models/Assessment.js";
import { Batch } from "../models/Batch.js";
import { User } from "../models/User.js";
import { UserAssessment } from "../models/UserAssessment.js";
import { ApiResponse } from "../utils/ApiResponse.js";