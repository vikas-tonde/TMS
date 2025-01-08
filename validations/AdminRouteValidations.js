import { check } from 'express-validator';
import prisma from '../DB/db.config.js';

const validateIncomingBulkUsers = [
    check('batchName', 'Enter the valid name').isLength({ min: 3 }),
    check('location', 'Enter the valid location').isLength({ min: 3 }),

]
let date = new Date();
date.setDate(date.getDate() + 1);
const validateIncomingBulkTest = [
    check('moduleName', 'Enter the valid name').isLength({ min: 3 }),
    check('assessmentName', 'Enter the valid assessment name').isLength({ min: 3 }),
    check('date', 'Enter the valid date').isBefore(date.toDateString()),
    check('totalMarks', 'Enter the valid total marks').isNumeric().exists({ checkFalsy: true })
];

const validateUser = [
    check('firstName', 'Enter the valid name').isLength({ min: 3 }),
    check('lastName', 'Enter the valid name').isLength({ min: 3 }),
    check('email', 'Enter the valid email').isEmail().custom(async (value) => {
        const user = await prisma.user.findUnique({
            where: { email: value }
        });
        if (user) {
            throw new Error(`User with email ${value} already present`);
        }
        return true;
    }),
    check('password', 'Enter the strong password').isLength({ min: 8 }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }).custom(async (value) => {
        const user = await prisma.user.findUnique({
            where: { employeeId: value }
        });
        if (user) {
            throw new Error(`User with employee Id ${value} already present.`);
        }
        return true;
    }),
    check('location', 'Enter the valid location').isLength({ checkFalsy: true }).custom(async (value) => {
        const location = await prisma.location.findFirst({
            where: { name: value }
        });
        if (!location) {
            throw new Error(`Location with ${value} name does not present in system.`);
        }
        return true;
    }),
    check('batch', 'Enter the valid batchId').isLength({ min: 1 }),
    check('role', 'Enter the valid role id').exists({ checkFalsy: true })  /*.matches([/\b(?:Admin|Trainee)\b/]),*/
];

const validateAddSingleAssessmentDetails = [
    check('assessmentId', 'Enter the vallid assessment id.').isLength({ checkFalsy: true }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }),
    check('obtainedMarks', 'Enter the marks obtained.').isNumeric().exists({ checkFalsy: true })
];

const validateExistingUserInBatch = [
    check('batchId', 'Enter the vallid batch Id.').isLength({ checkFalsy: true }).custom(async (value) => {
        const batch = await prisma.batch.findUnique({ where: { id: BigInt(value) } });
        if (!batch) {
            throw new Error(`Batch with Id ${value} does not exit in system.`);
        }
        return true;
    }),
    check('employeeId', 'Enter the valid employee id.').exists({ checkFalsy: true }).custom(async (value) => {
        const user = await prisma.user.findUnique({ where: { employeeId: value } });
        if (!user) {
            throw new Error(`User with employee Id ${value} does not exit in system.`);
        }
        return true;
    }),
    check('location', 'Enter the valid location.').exists({ checkFalsy: true }).custom(async value => {
        let location = await prisma.location.findFirst({ where: { name: value } });
        if (!location) {
            throw new Error("Given location does not exist in sytem.");
        }
        return true;
    })
];

export {
    validateAddSingleAssessmentDetails, validateIncomingBulkTest,
    validateIncomingBulkUsers, validateUser, validateExistingUserInBatch
};
