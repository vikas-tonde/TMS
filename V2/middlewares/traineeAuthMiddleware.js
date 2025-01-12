import { ApiResponse } from "../../utils/ApiResponse.js"
import { ROLES } from "../../utils/roles.js";

export const traineeAuthMiddleware = async (req, res, next) => {
    try {
        if (req.user?.role.name !== ROLES.TRAINEE) {
            return res.status(401).json(new ApiResponse(401, {}, "Unauthorized request"));
        }
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse(401, {}, error?.message || "Something went wrong while verifying your identity."));
    }
}