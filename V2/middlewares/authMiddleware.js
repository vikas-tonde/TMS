import jwt from "jsonwebtoken";
import prisma from "../../DB/db.config.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import logger from "../../utils/logger.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      logger.warn("Token not found, Unauthorized request.");
      return res.status(401).json(new ApiResponse(401, {}, "Unauthorized request"));
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.id,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        profileImage: true,
        appPassword: true,
        mailsEnabled: true,
        location: true,
        skills: {
          select:{
            skill: true,
          }
        },
        languages: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user) {
      logger.warn("Invalid access token.");
      return res.status(401).json(new ApiResponse(401, {}, "Invalid Access Token"));
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json(new ApiResponse(401, {}, error?.message || "Invalid Access Token"));
  }
}