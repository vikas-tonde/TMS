import { check } from 'express-validator';

const validateIncomingBulkTest = [
    check('moduleName', 'Enter the valid name').isLength({ min: 3 }),
    check('date', 'Enter the valid name').isBefore(new Date().toDateString()),
    check('totalMarks', 'Enter the valid total marks').isNumeric().exists({ checkFalsy: true })
];

export {
    validateIncomingBulkTest 
};