import bcrypt from "bcryptjs";
import fs from 'fs';
import jwt from "jsonwebtoken";
import path from 'path';
import prisma from '../../DB/db.config.js';
import { ApiResponse } from "../../utils/ApiResponse.js";

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
    console.log(error);
    return "";
  }
}

const loginUser = async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId) {
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
    return res.status(404).json(new ApiResponse(404, {}, "User does not exist"));
  }

  const isPasswordValid = await isPasswordCorrect(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials"));
  }
  const accessToken = await generateAccessToken(user);
  if (!accessToken) {
    return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials"));
  }

  const options = {
    httpOnly: true,
    path: "/",
    maxAge: process.env.COOKIE_EXPIRY
  }
  user.id = user.id.toString();
  return res
    .cookie("accessToken", accessToken, options)
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          user, accessToken
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
      console.error(`Error while sending file: ${err.message}`);
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
      console.error(`Error while sending file: ${err.message}`);
      res.status(500).send('Error occurred while downloading the file.');
    }
  });
}

const getSelf = (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { user: req.user }, "This is your information.")
  );
}
// const getAllUserModules = async (req, res) => {
//   try {
//     let batch = (await Batch.findOne({ _id: req.user.batch }))[0];
//     let moduleNames = await Assessment.distinct("moduleName", { _id: { $in: batch.assessments } });
//     return res.status(200).json(new ApiResponse(200, moduleNames));
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
//   }
// }

const chanegPassword = async (req, res) => {
  try {
    let { newPassword, confirmPassword } = req.body;
    if (newPassword != confirmPassword) {
      return res.status(400).json(new ApiResponse(400, {}, "Both password strings doesn't match with each other."));
    }
    const salt = await bcrypt.genSalt(10);
    let hashedPassword = await bcrypt.hash(user.password, salt);
    let user = await prisma.user.update({
      where: { employeeId: req.user.employeeId },
      data: { password: hashedPassword }
    });
    return res.status(200).json(new ApiResponse(200, {}, "Password is changed successfully."));
  } catch (error) {
    console.log(error);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while changing password."));
  }
}

const signOut = async (req, res) => {
  const token = req.cookies?.accessToken;
  if (!token) {
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
    return res.status(400).json(new ApiResponse(400, {}, "No file is sent"));
  }
  try {
    let { filename } = req.file;
    let filePath = process.env.IMAGE_UPLOAD_LOCATION + filename;
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
    console.log(e);
    return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
  }
}

const getProfileImage = (req, res) => {
  const { imageName } = req.params;
  const fullImagePath = path.join(global.ROOT_DIR, process.env.IMAGE_UPLOAD_LOCATION, imageName);

  // Check if the image exists
  fs.access(fullImagePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('Image not found');
    }
    // Send the image file
    res.sendFile(fullImagePath);
  });
};



export {
  addProfileImage, chanegPassword,
  downloadMarksheetSample, downloadTraineeSampleFile, getProfileImage, getSelf, loginUser, signOut
};

