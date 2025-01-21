import { ApiResponse } from "../../utils/ApiResponse.js"
import logger from "../../utils/logger.js";
import { ROLES } from "../../utils/roles.js";

export const adminAuthMiddleware = async (req, res, next) => {
    try {
        if (req.user?.role.name !== ROLES.ADMIN) {
            logger.warn(`User ${req.user.firstName} ${req.user.lastName} (${req.user.employeeId}) is unauthorized to access this resource`);
            return res.status(401).json(new ApiResponse(403, {}, "Unauthorized request"));
        }
        next();
    } catch (error) {
        logger.error(error);
        return res.status(401).json(new ApiResponse(403, {}, error?.message || "Something went wrong while verifying your identity."));
    }
}