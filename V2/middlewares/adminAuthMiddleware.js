import { ApiResponse } from "../../utils/ApiResponse.js"

export const adminAuthMiddleware = async (req, res, next) => {
    try {
        if (req.user?.role.name !== 'Admin') {
            return res.status(401).json(new ApiResponse(401, {}, "Unauthorized request"));
        }
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse(401, {}, error?.message || "Something went wrong while verifying your identity."));
    }
}