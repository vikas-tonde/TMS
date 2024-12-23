import mongoose from "mongoose";

const MetadataSchema = new mongoose.Schema(
    {
        locations: [{
            type: String,
            required: true,
            trim: true,
        }],
        roles: [{
            type: String,
            required: true,
            trim: true,
        }]

    }, { collection: "Metadata", versionKey: false }
);

export const Metadata = mongoose.model("Metadata", MetadataSchema);