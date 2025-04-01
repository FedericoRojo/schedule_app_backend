function isAdmin(req, res, next){
    if( req.user && req.user.role == 2 ){
        return next();
    }else{
        return res.status(403).json({message: 'Access denied, admin only'});
    }
}

module.exports = {isAdmin}