import mongoose from "mongoose";

const AssessmentSchema = new mongoose.Schema(
    {
        moduleName: {
            type: String,
            required: true
        },
        quizName: {
            type: String,
            required: true
        },
        date: {
            type: String,
            required: true
        },
        totalMarks: {
            type: Number
        }
    }, { collection: "Assessments", versionKey: false }
);

export const Assessment = mongoose.model('Assessments', AssessmentSchema);