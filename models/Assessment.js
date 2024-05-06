import mongoose from "mongoose";

const AssessmentSchema = new mongoose.Schema(
    {
        moduleName: {
            type: String,
            required: true
        },
        assessmentName: {
            type: String,
            required: true
        },
        date: {
            type: String,
            required: true
        },
        totalMarks: {
            type: Number
        },
        assessmentType:{
            type: String,
            required: true,
            enum : ["Quiz","Assignment","Presentation"]
        }
    }, { collection: "Assessments", versionKey: false }
);

export const Assessment = mongoose.model('Assessments', AssessmentSchema);