const {Router} = require ("express");
const serviceController = require("../controllers/serviceController");
const passport = require('passport');
const {isAdmin} = require('../middleware/userMiddleware');

const serviceRouter = Router();

serviceRouter.post('/new', 
    passport.authenticate('jwt', { session: false }), serviceController.createService);
serviceRouter.put('/update/:serviceID', passport.authenticate('jwt', { session: false }), isAdmin, serviceController.updateService);
serviceRouter.delete('/:serviceID', passport.authenticate('jwt', { session: false }), isAdmin, serviceController.deleteService);

serviceRouter.get('/', passport.authenticate('jwt', { session: false }), serviceController.getServices);
serviceRouter.get('/:serviceID', passport.authenticate('jwt', { session: false }), serviceController.getServiceByID);

module.exports = serviceRouter;