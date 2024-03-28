import { User } from "../models/User.js";
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { ApiResponse } from "../utils/ApiResponse.js";
import { Batch } from "../models/Batch.js";

const generateAccessAndRefreshTokens = async (employeeId) => {
    try {
        const user = (await User.find({ employeeId: employeeId }))[0];
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        return {};
    }
}

const addUser = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    } else {
        const userFromReq = req.body;
        const salt = await bcrypt.genSalt(10);
        const { name, email, password, employeeId, location } = userFromReq;
        const hashedPassword = await bcrypt.hash(password, salt);
        const role = "Trainee";
        try {
            const user = new User({ name: name, email: email, password: hashedPassword, employeeId: employeeId, location: location, role: role });
            await user.save()
            return res.status(200).json(new ApiResponse(200, user, "User registered successfully"));
        }
        catch (e) {
            console.log(e);
            return res.status(500).json(new ApiResponse(500, {}, "Something went wrong while registering the user."));
        }
    }
}

const loginUser = async (req, res) => {
    const { employeeId, password } = req.body;

    if (!employeeId) {
        return res.status(400).json(new ApiResponse(400, {}, "username or email is required"));
    }
    const user = await User.findOne({ employeeId: employeeId });

    if (!user) {
        return res.status(404).json(new ApiResponse(404, {}, "User does not exist"));
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials"));
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.employeeId);
    if ((!accessToken && !refreshToken)) {
        return res.status(401).json(new ApiResponse(401, {}, "Invalid user credentials"));
    }
    const loggedInUser = await User.find({ employeeId: user.employeeId }).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        path: "/"
    }
    return res
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser[0], accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        );

}

const getSelf = (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, { user: req.user }, "This is your information.")
    );
}
const getAllUserModules= async (req, res)=>{
    try {
        let batch = (await Batch.findOne({ _id: req.user.batch }))[0];
        let moduleNames = await Assessment.distinct("moduleName", {_id: {$in:batch.assessments}});
        return res.status(200).json(new ApiResponse(200, moduleNames));
    } catch (error) {
        console.log(error);
        return res.status(500).json(new ApiResponse(500, {}, "Something went wrong"));
    }
}

export { addUser, loginUser, getSelf, getAllUserModules };