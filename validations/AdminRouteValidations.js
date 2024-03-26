import { check } from 'express-validator';

const validateIncomingBulkUsers = [
    check('batchName', 'Enter the valid name').isLength({ min: 3 }),
    check('location', 'Enter the valid location').isLength({ min: 3 }),

]

const validateIncomingBulkTest = [
    check('moduleName', 'Enter the valid name').isLength({ min: 3 }),
    check('quizName', 'Enter the valid name').isLength({ min: 3 }),
    check('date', 'Enter the valid date').isBefore(new Date().toDateString()),
    check('totalMarks', 'Enter the valid total marks').isNumeric().exists({ checkFalsy: true })
];

export {
    validateIncomingBulkTest,
    validateIncomingBulkUsers
};