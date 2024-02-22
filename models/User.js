import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            require: true
        },
        email: {
            type: String,
            unique: true,
            required: true
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
        location:{
            type : String,
            required : true
        },
        status:{
            type : String
        },
        remarks:{
            type:String
        },
        
    }, { collection: User }
);

export const User = mongoose.model('User', UserSchema);