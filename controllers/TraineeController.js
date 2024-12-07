import { UserAssessment } from "../models/UserAssessment.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getExams = async (req, res) => {
    try {
        let examDetails = await UserAssessment.aggregate([
            { $match: { userRef: req.user._id } },
            {
                $lookup: {
                    from: "Assessments",
                    localField: "assessmentRef",
                    foreignField: "_id",
                    as: "assessmentDetails"
                }
            },
            { $unwind: "$assessmentDetails" },
            {
                $project: {
                    assessmentId: "$assessmentDetails._id",
                    marksObtained: 1,
                    moduleName: "$assessmentDetails.moduleName",
                    assessmentName: "$assessmentDetails.assessmentName",
                    date: "$assessmentDetails.date",
                    assessmentType: "$assessmentDetails.assessmentType",
                    totalMarks: "$assessmentDetails.totalMarks"
                }
            }
        ]);
        if(examDetails.length){
            return res.status(200).json(new ApiResponse(200, examDetails));
        }
        else{
            return res.status(200).json(new ApiResponse(200, examDetails, "You have not given any assessment yet."));
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
    }
}

export {
    getExams
};
