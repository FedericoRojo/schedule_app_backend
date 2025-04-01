const pool = require("../config/pool");
const {genPassword, validPassword} = require("../lib/passwordUtils");
const {issueJWT} = require('../lib/utils');
const {body: validateBody, validationResult} = require('express-validator');
require('dotenv').config();

const alphaErr = "must only contain letters";
const lengthErr = "must be between 1 and 10 characters";


const validateUser = [
    validateBody("firstName").trim()
        .isAlpha().withMessage(`First name ${alphaErr}`)
        .isLength({min:1, max:10}).withMessage(`First name ${lengthErr}`),
    validateBody("lastName").trim()
        .isAlpha().withMessage(`Last name ${alphaErr}`)
        .isLength({min:1, max:10}).withMessage(`Last name ${lengthErr}`),
    validateBody('email')
        .trim().isEmail().withMessage('Invalid email address'),
    validateBody('password')
        .trim().isLength({min: 4, max: 100}).withMessage('Password must be between 6 and 100 characters')
        .not().isEmpty().withMessage('Password cannot be empty')
];

const validateLoginUser = [
    validateBody('email')
    .trim().isEmail().withMessage('Invalid email address'),
    validateBody('password')
    .trim().isLength({min: 4, max: 100}).withMessage('Password must be between 6 and 100 characters')
    .not().isEmpty().withMessage('Password cannot be empty')
]

exports.registerUser = [
    validateUser,
    async (req, res) => {
        console.log('here');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array() 
            });
        }
        
        const saltHash = genPassword(req.body.password);
    
        const salt = saltHash.salt;
        const hash = saltHash.hash;
        
        try {
            
            const {rows} = await pool.query(`SELECT * FROM users WHERE email = $1;`, [req.body.email]);
            
            if(rows.length > 0){
                return res.status(400).json({
                    success: false,
                    result: 'Email already exists'
                })
            }else{

                await pool.query('INSERT INTO users(first_name, last_name, email, hash, salt) VALUES ($1, $2, $3, $4, $5) RETURNING id;', 
                    [req.body.firstName, req.body.lastName, req.body.email, hash, salt]);
                

                return res.json({ 
                    success: true,
                    result: 'User registered correctly'
                });

            }
        } catch (err) {
            return res.status(500).json({ success: false, result: err });
        }
    }
] 

exports.loginUser = [
    validateLoginUser,
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array() 
            });
        }

        try{
            const {rows} = await pool.query('SELECT * FROM users WHERE email = $1;', [req.body.email]);
            const user = rows[0];
            if(!user){
                return res.status(401).json({success: false, msg: 'Could not find the user'});
            }
    
            const isValid = validPassword(req.body.password, user.hash, user.salt);
    
            if(isValid){
                const tokenObject = issueJWT(user);
                res.status(200).json({
                    result: user.status,
                    success: true,
                    token: tokenObject.token,
                    expiresIn: tokenObject.expires,
                });
            } else {
                res
                .status(401)
                .json({ success: false, msg: "Invalid password" });
            }
    
        }catch(error){
            next(error);
        }
    }
]

exports.validUser = [
    async (req, res) =>  {

        if(req.user != null){
            const {hash, salt, id, created_at, ...result} = req.user; 
            return res.json({
                success: true,
                result: result
            });
        }else{
            return res.json({
                success: false,
                result: null
            });
        }
    }
    
]

exports.updateUserRole = async function(req, res){
    const {userID} = req.params;
    try{
        const {rows} = await pool.query('SELECT * FROM users WHERE id = $1;', [userID]);
        
        if(rows[0] == null){
            return res.status(404).json({success:false, message: "User with this ID don't exist"})
        }

        await pool.query('UPDATE users SET role = 1 WHERE id = $1', [userID]);

        return res.json({
            success: true,
            message: "User role updated correctly"
        })

    }catch(e){
        res.status(400)
        .json({ success: false, msg: e });
    }
}


