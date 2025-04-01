const pool = require("../config/pool");
require('dotenv').config();
const { body, validationResult } = require('express-validator');

const validateService = [
    body('name').trim().notEmpty().withMessage('Service name is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('description').optional().trim()
];


exports.createService = [
    ...validateService,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { name, duration, description } = req.body;

            const result = await pool.query(
                `INSERT INTO services (name, duration, description) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, name, duration, description`,
                [name, duration, description]
            );

            res.status(201).json({
                success: true,
                service: result.rows[0]
            });

        } catch (error) {
            console.error('Error creating service:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to create service' 
            });
        }
    }
];


exports.getServices = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, duration, description 
             FROM services 
             ORDER BY name`
        );

        res.json({
            success: true,
            services: result.rows
        });

    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch services' 
        });
    }
};


exports.updateService = [
    ...validateService,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { serviceID } = req.params;
            const { name, duration, description } = req.body;

            // Update service
            const result = await pool.query(
                `UPDATE services 
                 SET name = $1, duration = $2, description = $3 
                 WHERE id = $4 
                 RETURNING id, name, duration, description`,
                [name, duration, description, serviceID]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Service not found' 
                });
            }

            res.json({
                success: true,
                service: result.rows[0]
            });

        } catch (error) {
            console.error('Error updating service:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update service' 
            });
        }
    }
];

exports.getServiceByID = async (req, res) => {
    try{
        const {serviceID} = req.params;

        const {rows} = await pool.query('SELECT * FROM services WHERE id = $1', [serviceID]);

        if(rows.length == 0){
            return res.status(404).json({ 
                success: false, 
                error: 'Service not found' 
            });
        }

        return res.json({
            success: true,
            result: rows[0]
        })

    }catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get service' 
        });
    }
}


exports.deleteService = async (req, res) => {
    try {
        const { serviceID } = req.params;

        const checkResult = await pool.query(
            `SELECT id FROM services WHERE id = $1`,
            [serviceID]
        );

        if (checkResult.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Service not found' 
            });
        }

        await pool.query(`DELETE FROM services WHERE id = $1`, [serviceID] );

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting service:', error);
        
        if (error.code === '23503') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete service - it is being referenced by appointments' 
            });
        }

        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete service' 
        });
    }
};

