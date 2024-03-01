import { ApiResponse } from "../utils/ApiResponse.js"

export const adminAuthMiddleware = async (req, res, next) => {
    try {
        
        if (req.user.role !== 'Admin') {
            return res.status(401).json(new ApiResponse(401, {}, "Unauthorized request"));
        }
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse(401, {}, error?.message || "Invalid Access Token"));
    }
}