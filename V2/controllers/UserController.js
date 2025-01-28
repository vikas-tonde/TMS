import bcrypt from "bcryptjs";
import fs from 'fs';
import jwt from "jsonwebtoken";
import path from 'path';
import prisma from '../../DB/db.config.js';
import { ApiResponse } from "../../utils/ApiResponse.js";
import logger from "../../utils/logger.js";
import { encrypt } from "../../utils/encrypt.js";

const isPasswordCorrect = async function (password, originalPassword) {
  return await bcrypt.compare(password, originalPassword);
}

const generateAccessToken = async (user) => {
  try {
    const id = BigInt(user.id);
    const accessToken = jwt.sign(
      {
        id: id.toString(),
        email: user.email
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
      }
    );
    return accessToken;
  } catch (error) {
    logger.error(error);
    return "";
  }
}

const loginUser = async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId) {
    logger.debug("Employee id is empty.")
    return res.status(400).json(new ApiResponse(400, {}, "employee Id is required"));
  }
  const user = await prisma.user.findUnique({
    where: {
      employeeId,
      isActive: true
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      password: true,
      profileImage: true,
      role: {
        select: {
          name: true
        }
      }
    }
  });

  if (!user) {
    logger.debug("User does not exist in system.");
    return res.status(404).json(new ApiResponse(404, {}, "User does not exist in system."));
  }

  const isPasswordValid = await isPasswordCorrect(password, user.password);

  if (!isPasswordValid) {
    logger.debug("Invalid user credentials.");
    return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials."));
  }
  const accessToken = await generateAccessToken(user);
  if (!accessToken) {
    logger.debug("Invalid user credentials.");
    return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials."));
  }

  const options = {
    httpOnly: true,
    path: "/",
    maxAge: process.env.COOKIE_EXPIRY
  }
  delete user.password;
  return res
    .cookie("accessToken", accessToken, options)
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          user
        },
        "User logged In Successfully"
      )
    );

}

const downloadTraineeSampleFile = async (req, res) => {
  const filePath = path.join(global.ROOT_DIR, process.env.DOWNLOADABLE_FILE_LOCATION, "TraineeExcelSample.xlsx")
  console.log(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="TraineeExcelSample.xlsx"`);
  res.download(filePath, (err) => {
    if (err) {
      logger.error(`Error while sending file: ${err.message}`);
      res.status(500).send('Error occurred while downloading the file.');
    }
  });
}

const downloadMarksheetSample = async (req, res) => {
  const filePath = path.join(global.ROOT_DIR, process.env.DOWNLOADABLE_FILE_LOCATION, "SampleMarksheet.xlsx")
  console.log(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="SampleMarksheet.xlsx"`);
  res.download(filePath, (err) => {
    if (err) {
      logger.error(`Error while sending file: ${err.message}`);
      res.status(500).send('Error occurred while downloading the file.');
    }
  });
}

const getSelf = (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { user: req.user }, "This is your information.")
  );
}

const chanegPassword = async (req, res) => {
  try {
    let { newPassword, confirmPassword } = req.body;
    if (newPassword != confirmPassword) {
      logger.debug("Both password strings doesn't match with each other.");
      return res.status(400).json(new ApiResponse(400, {}, "Both password strings doesn't match with each other."));
    }
    const salt = await bcrypt.genSalt(10);
    let hashedPassword = await bcrypt.hash(newPassword, salt);
    let user = await prisma.user.update({
      where: { employeeId: req.user.employeeId },
      data: { password: hashedPassword }
    });
    logger.debug("Password is changed successfully.");
    return res.status(200).json(new ApiResponse(200, {}, "Password is changed successfully."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while changing password."));
  }
}

const signOut = async (req, res) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    logger.warn("User already logged out.");
    return res.status(400).json(new ApiResponse(400, {}, "User already logged out."));
  }
  const options = {
    httpOnly: true,
    path: "/"
  }
  return res
    .cookie("accessToken", "", options)
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "User logged out Successfully"
      )
    );
}

const addProfileImage = async (req, res) => {
  if (req.file?.filename == null || req.file?.filename == undefined) {
    logger.warn("File is not sent.");
    return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
  }
  try {
    let { filename } = req.file;
    let user = await prisma.$transaction(async tx => {
      return await tx.user.update({
        where: { employeeId: req.user.employeeId },
        data: { profileImage: filename }
      });
    });
    if (user) {
      return res.status(200).json(new ApiResponse(200, { filename: req.file.filename }, "Image uploaded"));
    }
    return res.status(500).json(new ApiResponse(500, { filename: req.file.filename }, "Image uploading failed"));
  }
  catch (e) {
    logger.error(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getProfileImage = (req, res) => {
  const { imageName } = req.params;
  const fullImagePath = path.join(global.ROOT_DIR, process.env.IMAGE_UPLOAD_LOCATION, imageName);

  // Check if the image exists
  fs.access(fullImagePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(err);
      return res.status(404).send('Image not found');
    }
    // Send the image file
    res.sendFile(fullImagePath);
  });
};


const addAppPassword = async (req, res) => {
  let { employeeId, appPassword } = req.body;
  if (!employeeId || !appPassword) {
    logger.debug("Employee Id or app password is empty.");
    return res.status(400).json(new ApiResponse(400, {}, "Employee Id or app password is empty."));
  }
  try {
    let encryptedPassword = encrypt(appPassword, employeeId);
    let user = await prisma.user.update({
      where: { employeeId },
      data: { appPassword: encryptedPassword }
    });
    if (user) {
      logger.audit(`App password added successfully for ${user.firstName} ${user.lastName}`);
      return res.status(200).json(new ApiResponse(200, { user }, `App password added successfully for ${user.firstName} ${user.lastName}`));
    }
    return res.status(500).json(new ApiResponse(500, {}, "App password adding failed."));
  } catch (error) {
    logger.error(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while adding app password."));
  }
}


export {
  addProfileImage, chanegPassword,
  downloadMarksheetSample, downloadTraineeSampleFile, getProfileImage, getSelf,
  loginUser, signOut, addAppPassword
};

