const {Router} = require ("express");
const availabityController = require("../controllers/availabilityController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');

const availabilityRouter = Router();

availabilityRouter.post('/new', passport.authenticate('jwt', { session: false }), isAdmin, availabityController.createAvailability);
availabilityRouter.get('/', passport.authenticate('jwt', { session: false }), availabityController.getAvailability);
availabilityRouter.put('/update/:availabilityID', passport.authenticate('jwt', { session: false }), availabityController.updateAvailability);
availabilityRouter.delete('/:availabilityID', passport.authenticate('jwt', { session: false }), availabityController.deleteAvailability);


module.exports = availabilityRouter;