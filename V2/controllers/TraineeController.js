import prisma from "../../DB/db.config.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getExams = async (req, res) => {
    try {
        let examDetails = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                assessments: { select: { assessment: true, marksObtained: true, } }
            }
        });
        examDetails = examDetails.assessments.map((assessment) => {
            return { ...assessment.assessment, marksObtained: assessment.marksObtained }
        });
        if (examDetails) {
            return res.status(200).json(new ApiResponse(200, examDetails));
        }
        else {
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

