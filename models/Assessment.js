import mongoose from "mongoose";

const AssessmentSchema = mongoose.Schema(
    {
        module: {
            type: mongoose.Schema.ObjectId,
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        totalMarks:{
            type : Number
        }
    }
);