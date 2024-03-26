import mongoose from "mongoose";

const BatchSchema = new mongoose.Schema(
    {
        batchName: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        isLatest: {
            type: Boolean,
            default: true
        },
        location: {
            type: String,
            required: true
        },
        currentTraining: {
            type: String,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        trainees: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        assessments: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Assessments"
            }
        ]
    }, { collection: "Batch", versionKey: false }
);

export const Batch = mongoose.model("Batch", BatchSchema);