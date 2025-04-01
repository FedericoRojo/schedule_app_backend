const pool = require("../config/pool");
const { body, validationResult } = require('express-validator');
const { DateTime } = require('luxon');

const validateAvailability = [
    body('employee_id').isInt().withMessage('Employee ID must be an integer'),
    body('date').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
    body('start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
    body('end_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
    body().custom((value, { req }) => {
        const start = DateTime.fromISO(`${req.body.date}T${req.body.start_time}`);
        const end = DateTime.fromISO(`${req.body.date}T${req.body.end_time}`);
        if (end <= start) {
            throw new Error('End time must be after start time');
        }
        return true;
    })
];


exports.createAvailability = [
    ...validateAvailability,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { employee_id, date, start_time, end_time } = req.body;

            const overlapCheck = await pool.query(
                `SELECT id FROM availability 
                 WHERE employee_id = $1 AND date = $2 
                 AND (
                    (start_time < $4 AND end_time > $3)
                    OR (start_time = $3)
                 )`,
                [employee_id, date, start_time, end_time]
            );

            if (overlapCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Availability slot overlaps with existing slot'
                });
            }

            const result = await pool.query(
                `INSERT INTO availability 
                 (employee_id, date, start_time, end_time) 
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, employee_id, date, start_time, end_time`,
                [employee_id, date, start_time, end_time]
            );

            res.status(201).json({
                success: true,
                availability: result.rows[0]
            });

        } catch (error) {
            console.error('Error creating availability:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to create availability slot' 
            });
        }
    }
];


exports.getAvailability = async (req, res) => {
    try {
        const { employee_id, date, start_date, end_date } = req.query;
        
        let query = `SELECT a.id, a.employee_id, u.first_name, u.last_name, 
                    a.date, a.start_time, a.end_time 
                    FROM availability a
                    JOIN users u ON a.employee_id = u.id`;
        const params = [];
        let conditions = [];
        let paramIndex = 1;

        if (employee_id) {
            conditions.push(`a.employee_id = $${paramIndex}`);
            params.push(employee_id);
            paramIndex++;
        }

        if (date) {
            conditions.push(`a.date = $${paramIndex}`);
            params.push(date);
            paramIndex++;
        } else if (start_date && end_date) {
            conditions.push(`a.date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
            params.push(start_date, end_date);
            paramIndex += 2;
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY a.date, a.start_time`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            availability: result.rows
        });

    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch availability slots' 
        });
    }
};


exports.updateAvailability = [
    ...validateAvailability,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { availabilityID } = req.params;
            const { employee_id, date, start_time, end_time } = req.body;

            const existing = await pool.query(`SELECT id FROM availability WHERE id = $1`, [availabilityID] );

            if (existing.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Availability slot not found' 
                });
            }

            const overlapCheck = await pool.query(
                `SELECT id FROM availability 
                 WHERE employee_id = $1 AND date = $2 
                 AND id != $5
                 AND (
                    (start_time < $4 AND end_time > $3)
                    OR (start_time = $3)
                 )`,
                [employee_id, date, start_time, end_time, availabilityID]
            );

            if (overlapCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Updated availability slot overlaps with existing slot'
                });
            }

            const result = await pool.query(
                `UPDATE availability 
                 SET employee_id = $1, date = $2, start_time = $3, end_time = $4
                 WHERE id = $5
                 RETURNING id, employee_id, date, start_time, end_time`,
                [employee_id, date, start_time, end_time, availabilityID]
            );

            res.json({
                success: true,
                availability: result.rows[0]
            });

        } catch (error) {
            console.error('Error updating availability:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update availability slot' 
            });
        }
    }
];

exports.deleteAvailability = async (req, res) => {
    try {
        const { availabilityID } = req.params;
        const result = await pool.query(
            `DELETE FROM availability 
             WHERE id = $1
             RETURNING id`,
            [availabilityID]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Availability slot not found' 
            });
        }

        res.json({
            success: true,
            message: 'Availability slot deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting availability:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete availability slot' 
        });
    }
};