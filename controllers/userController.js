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
            console.log('aca', req);
            if(rows.length > 0){
                return res.status(400).json({
                    success: false,
                    result: 'Email already exists'
                })
            }else{

                await pool.query('INSERT INTO users(first_name, last_name, email, hash, salt, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;', 
                    [req.body.firstName, req.body.lastName, req.body.email, hash, salt, req.body.phoneNumber]);
                

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
                const { first_name, last_name, email, phone, role, id } = user;
                const userData = { first_name, last_name, email, phone, role, id };
                
                res.status(200).json({
                    result: userData,
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
            const {first_name, last_name, email, phone, role, created_at} = req.user; 
            const userData = { first_name, last_name, email, phone, role, created_at };
            return res.json({
                success: true,
                result: userData 
            });
        }else{
            return res.json({
                success: false,
                result: null
            });
        }
    }
    
]



exports.getEmployees = async function(req, res) {
    try{
        const {rows} = await pool.query(`
            SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.role,
            COALESCE(
                json_agg(
                json_build_object(
                    'service_id', s.id,
                    'service_name', s.name
                )
                ) FILTER (WHERE s.id IS NOT NULL),
                '[]'::json
            ) AS services
            FROM users u 
            LEFT JOIN EmployeeServices es ON u.id = es.employee_id 
            LEFT JOIN Services s ON s.id = es.service_id
            WHERE u.role >= 1
            GROUP BY u.id, u.first_name, u.last_name;
`);
        res.json({
            success: true,
            result: rows
        })
    }catch(e){
        res.json({
            success: false,
            result: "Error while trying to get employees"
        })
    }
}

exports.deleteUser = async function(req, res) {
    try{
        const {userID} = req.params;
        await pool.query(`DELETE FROM users WHERE id = $1;`, [userID]);
        res.json({
            success: true,
            result: 'User deleted correctly'
        })
    }catch(e){
        res.json({
            success: false,
            result: "Error while trying to delete users"
        })
    }
}

exports.updateUser = async function (req, res) {
    const {userID} = req.params
    const { firstName, lastName, role, services } = req.body;
  
    try {
  
      await pool.query(`
        UPDATE users
        SET first_name = $1,
            last_name = $2,
            role = $3
        WHERE id = $4
      `, [firstName, lastName, role, userID]);
  
      // Remove all existing associations in EmployeeServices for this user.
      const deleteAssociationsQuery = `
        DELETE FROM EmployeeServices
        WHERE employee_id = $1
      `;
      await pool.query(deleteAssociationsQuery, [userID]);
  
      if (Array.isArray(services) && services.length > 0) {
        // Build a multi-row INSERT statement.
        // For example: INSERT INTO EmployeeServices (employee_id, service_id)
        // VALUES ($1, $2), ($3, $4), ..., ($n, $n+1)
        let insertValues = [];
        const valuesClauses = services.map((serviceId, index) => {
          // For each service, push employee id and service id.
          insertValues.push(userID, serviceId);
          // Calculate placeholders for each tuple.
          const idx = index * 2;
          return `($${idx + 1}, $${idx + 2})`;
        }).join(", ");
  
        const insertAssociationsQuery = `
          INSERT INTO EmployeeServices (employee_id, service_id)
          VALUES ${valuesClauses}
        `;
        await pool.query(insertAssociationsQuery, insertValues);
      }
  
      res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user", error);
      res.status(500).json({ error: "Error updating user" });
    }
  };

exports.searchUsersByName = async (req, res) => {
    try {
      const { firstName, lastName } = req.query;
        
      if (!firstName && !lastName) {
        return res.status(400).json({ 
          error: 'Must provide at least one search parameter (firstName or lastName)' 
        });
      }
  
      const searchParams = [];
      const whereClauses = [];
      
      if (firstName) {
        searchParams.push(`%${firstName}%`);
        whereClauses.push(`first_name ILIKE $${searchParams.length}`);
      }
      
      if (lastName) {
        searchParams.push(`%${lastName}%`);
        whereClauses.push(`last_name ILIKE $${searchParams.length}`);
      }
  
      // Construct query
      const queryText = `
        SELECT 
          id,
          first_name AS "firstName",
          last_name AS "lastName",
          email,
          phone,
          role,
          created_at AS "createdAt"
        FROM Users
        WHERE ${whereClauses.join(' AND ')} AND role = 0
      `;

      const result = await pool.query(queryText, searchParams);
      
      res.json({
        success: true,
        result: result.rows
      });
  
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
}
  
exports.updateUserRole = async function(req, res) {
    try{
        const {userID} = req.params;
        const {role} = req.body;
        console.log(userID, role);
        if(role > 2){
            res.status(400).json({
                success: false,
                error: "Error the role must be less than 2"
            })    
        }

        const {rows} = await pool.query('SELECT * FROM users WHERE id = $1;', [userID]);
        
        if(rows[0] == null){
            return res.status(404).json({success:false, message: "User with this ID don't exist"})
        }

        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userID])

        res.status(200).json({
            success: true,
            result: 'User role updated correctly'
        })

    }catch(e){
        res.status(500).json({
            success: false,
            error: "Error while updating user role"
        })
    }
}
