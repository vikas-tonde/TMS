import bcrypt from 'bcryptjs';
import prisma from "../DB/db.config.js";
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

export const populatePostgre = async () => {
    let roles = await prisma.role.findMany({ select: { id: true } });
    if (!roles.length) {
        await prisma.role.createMany({
            data: [{ name: "Admin" }, { name: "Trainee" }]
        });
    }
    let locations = await prisma.location.findMany({ select: { id: true } });
    if (!locations.length) {
        await prisma.location.createMany({
            data: [{ name: "Pune" }, { name: "Banglore" }, { name: "Chennai" }, { name: "Hyderabad" }]
        });
    }
    let user = await prisma.user.findUnique({
        where: { employeeId: "10431" },
        select: { id: true }
    });
    if (!user) {
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash("jyoti@123", salt);
        const role = await prisma.role.findFirst({
            where: { name: "Admin" }
        });
        const location = await prisma.location.findFirst({
            where: { name: "Pune" }
        });
        user = await prisma.$transaction(async tx => {
            return await tx.user.create({
                data: {
                    employeeId: "10431",
                    firstName: "Jyoti",
                    lastName: "Khaire",
                    email: "jyoti.khaire@intelizign.com",
                    password: password,
                    role: { connect: { id: role.id } },
                    location: { connect: { id: location.id } }
                }
            });
        });
    }
}