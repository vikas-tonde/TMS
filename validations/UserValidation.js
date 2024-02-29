import { check } from 'express-validator';

const validateUser = [
    check('firstName', 'Enter the valid name').isLength({ min: 3 }),
    check('lastName', 'Enter the valid name').isLength({ min: 3 }),
    check('email', 'Enter the valid email').isEmail(),
    check('password', 'Enter the strong password').isLength({ min: 8 }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }),
    check('location', 'Enter the valid location').isLength({ min: 3 }),
];

const validateLogin = [
    check('password', 'Enter the strong password').isLength({ min: 8 }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }),
];

export {
    validateUser,
    validateLogin
};