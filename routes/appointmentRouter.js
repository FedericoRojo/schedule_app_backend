const {Router} = require ("express");
const appointmentController = require("../controllers/appointmentController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');

const appointmentRouter = Router();

appointmentRouter.post('/new', passport.authenticate('jwt', { session: false }), appointmentController.createAppointment);
appointmentRouter.get('/', passport.authenticate('jwt', { session: false }), appointmentController.getUserAppointments);

appointmentRouter.get('/employee', passport.authenticate('jwt', { session: false }),  appointmentController.getWeeklyEmployeeAppointments);
appointmentRouter.get('/employee/personal', passport.authenticate('jwt', { session: false }),  appointmentController.getPersonalEmployeeAppointments);

appointmentRouter.get('/all', passport.authenticate('jwt', {session: false}), isAdmin, appointmentController.getEmployeeAppointments)

appointmentRouter.put('/update/:appointmentID', passport.authenticate('jwt', { session: false }), appointmentController.updateAppointment);

appointmentRouter.put('/cancel/:appointmentID', passport.authenticate('jwt', { session: false }), appointmentController.cancelAppointment);


module.exports = appointmentRouter;