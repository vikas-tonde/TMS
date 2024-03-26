import mongoose from "mongoose";

const UserAssessmentSchema = new mongoose.Schema(
    {
        userRef :{
            type: mongoose.Schema.Types.ObjectId,
            require : true,
            ref : "User"
        },
        assessmentRef : {
            type: mongoose.Schema.Types.ObjectId,
            require : true,
            ref : "Assessments"
        },
        marksObtained :{
            type : Number,
            require : true
        }
    }, {collection : "UsersAssessments", versionKey: false}
);

export const UserAssessment = mongoose.model('UsersAssessments', UserAssessmentSchema);