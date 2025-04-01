const {Router} = require ("express");
const userController = require("../controllers/userController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');


const userRouter = Router();

userRouter.post('/register', userController.registerUser);
userRouter.post('/login', userController.loginUser);
userRouter.post('/upgrade/:userID', passport.authenticate("jwt", {session: false}), isAdmin, userController.updateUserRole);
userRouter.get('/auth', passport.authenticate("jwt", {session: false}), userController.validUser);

module.exports = userRouter;