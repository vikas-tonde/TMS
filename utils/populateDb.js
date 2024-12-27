import { Metadata } from "../models/metadata.js"


export const populateDB = async () => {
    let data = await Metadata.find();
    if (!data.length) {
        console.log("Metadata is empty populating it..");
        data = new Metadata();
        data.locations = ["Pune", "Banglore", "Chennai", "Germany", "Hyderabad"];
        data.roles = ["Admin", "Trainee", "Trainer"];
        data.save();
    }
}