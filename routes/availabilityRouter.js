const {Router} = require ("express");
const availabityController = require("../controllers/availabilityController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');

const availabilityRouter = Router();

availabilityRouter.post('/new', passport.authenticate('jwt', { session: false }), availabityController.createAvailability);
availabilityRouter.get('/', passport.authenticate('jwt', { session: false }), availabityController.getAvailability);

availabilityRouter.get('/employee', passport.authenticate('jwt', { session: false }), availabityController.getWeeklyAvailabilityByEmployee);


availabilityRouter.put('/update/:availabilityID', passport.authenticate('jwt', { session: false }), availabityController.updateAvailability);
availabilityRouter.delete('/:availabilityID', passport.authenticate('jwt', { session: false }), availabityController.deleteAvailability);


module.exports = availabilityRouter;