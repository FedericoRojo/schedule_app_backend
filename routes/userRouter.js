const {Router} = require ("express");
const userController = require("../controllers/userController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');


const userRouter = Router();

userRouter.post('/register', userController.registerUser);
userRouter.post('/login', userController.loginUser);
userRouter.get('/employees', passport.authenticate("jwt", {session: false}), userController.getEmployees);
userRouter.put('/update/:userID', passport.authenticate("jwt", {session: false}), userController.updateUser);
userRouter.post('/upgrade/:userID', passport.authenticate("jwt", {session: false}), isAdmin, userController.updateUserRole);
userRouter.get('/auth', passport.authenticate("jwt", {session: false}), userController.validUser);
userRouter.delete('/:userID', passport.authenticate("jwt", {session: false}), userController.deleteUser);
userRouter.get('/search', passport.authenticate("jwt", {session: false}), userController.searchUsersByName);
userRouter.put('/:userID/role', passport.authenticate("jwt", {session: false}), userController.updateUserRole);

module.exports = userRouter;