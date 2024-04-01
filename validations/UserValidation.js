import { check } from 'express-validator';

const validateLogin = [
    check('password', 'Enter the strong password').isLength({ min: 8 }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }),
];

export {
    validateLogin
};