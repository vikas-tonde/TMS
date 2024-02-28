import mongoose from "mongoose";

const moduleNames = ["ITK", "BMIDE", "Query Builder", "Structure Manager", "Workflow Designer", "Access Manager", "Organization"];

const ModuleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            enum: moduleNames,
            required: true
        },
        trainer: {
            type: mongoose.Schema.ObjectId
        },
        
    }
);  