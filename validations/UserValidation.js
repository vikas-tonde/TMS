import { check } from 'express-validator';

const validateUser = [
    check('name', 'Enter the valid name').isLength({ min: 3 }),
    check('email', 'Enter the valid email').isEmail(),
    check('password', 'Enter the strong password').isLength({ min: 8 }),
    check('employeeId', 'Enter the valid employee id').exists({ checkFalsy: true }),
    check('location', 'Enter the valid location').isLength({ min: 3 }),
];

export default validateUser;