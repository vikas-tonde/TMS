import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

const UserSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            require: true,
            trim : true
        },
        lastName: {
            type: String,
            require: true,
            trim : true
        },
        email: {
            type: String,
            unique: true,
            required: true,
            trim : true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true
        },
        profileImage: {
            type: String
        },
        employeeId: {
            type: String,
            unique: true,
            required: true
        },
        location: {
            type: String,
            required: true
        },
        status: {
            type: String
        },
        remarks: {
            type: String
        },
        refreshToken: {
            type: String
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }, { collection: "User", versionKey: false }
);

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
}

UserSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
}
UserSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    );
}

export const User = mongoose.model('User', UserSchema);