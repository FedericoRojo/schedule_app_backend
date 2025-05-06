const pool = require("../config/pool");
const { body, validationResult } = require('express-validator');
const { DateTime } = require('luxon');

// Validation rules for appointments
const validateAppointment = [
    body('employee_id').isInt().withMessage('Employee ID must be an integer'),
    body('service_id').isInt().withMessage('Service ID must be an integer'),
    body('date').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
    body('start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
    body().custom(async (value, { req }) => {
        
        const service = await pool.query(
            'SELECT duration FROM services WHERE id = $1',
            [req.body.service_id]
        );
        if (service.rows.length === 0) {
            throw new Error('Service not found');
        }
        
        const available = await pool.query(
            `SELECT id FROM availability 
             WHERE employee_id = $1 
             AND date = $2
             AND start_time <= $3
             AND end_time >= $4`,
            [req.body.employee_id, req.body.date, req.body.start_time, req.body.end_time]
        );
        

        if (available.rows.length === 0) {
            throw new Error('Employee not available at this time');
        }

        const overlapping = await pool.query(
            `SELECT a.id FROM appointments a
             JOIN services s ON a.service_id = s.id
             WHERE a.employee_id = $1 
             AND a.date = $2
             AND a.status != 'cancelled'
             AND (
                 (a.start_time < $4 AND a.start_time + (s.duration || ' minutes')::interval > $3)
             )`,
            [req.body.employee_id, req.body.date, req.body.start_time, req.body.end_time]
        );

        if (overlapping.rows.length > 0) {
            throw new Error('Employee already has an appointment at this time');
        }
        return true;
    })
];



exports.getWeeklyAppointments = async (req, res) => {
    try {
      const { employeeId, startDay, endDay } = req.query;
  
      if (!employeeId || !startDay || !endDay) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
  
      const query = `
        SELECT 
          a.id,
          a.date,
          a.start_time,
          a.end_time,
          s.id AS service_id,
          s.name AS service_name,
          s.duration,
          u.id AS client_id,
          u.first_name AS client_first_name,
          u.last_name AS client_last_name
        FROM Appointments a
        JOIN Services s ON a.service_id = s.id
        JOIN Users u ON a.client_id = u.id
        WHERE a.employee_id = $1
          AND a.date BETWEEN $2 AND $3
          AND a.status IN ('pending', 'confirmed')
        ORDER BY a.date ASC, a.start_time ASC
      `;
  
      const { rows } = await pool.query(query, [employeeId, startDay, endDay]);
  
      // Format response
      const appointments = rows.map(row => ({
        id: row.id,
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        service: {
          id: row.service_id,
          name: row.service_name,
          duration: row.duration
        },
        client: {
          id: row.client_id,
          name: `${row.client_first_name} ${row.client_last_name}`
        }
      }));
  
      res.json({ success: true, result: appointments });
      
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };

exports.createAppointment = [
    ...validateAppointment,
    async (req, res) => {
        try {
            
            const { employee_id, service_id, date, start_time, end_time } = req.body;
            const client_id = req.user.id; 


            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            } 


            const service = await pool.query(
                'SELECT duration FROM services WHERE id = $1',
                [service_id]
            );
            const duration = service.rows[0].duration;

            const result = await pool.query(
                `INSERT INTO appointments 
                 (client_id, employee_id, service_id, date, start_time, status) 
                 VALUES ($1, $2, $3, $4, $5, 'pending')
                 RETURNING id, client_id, employee_id, service_id, date, start_time, status`,
                [client_id, employee_id, service_id, date, start_time]
            );

            res.status(201).json({
                success: true,
                appointment: result.rows[0],
                duration: duration
            });

        } catch (error) {
            console.error('Error creating appointment:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Failed to create appointment' 
            });
        }
    }
];

exports.getUserAppointments = async (req, res) => {
    try {
        const user_id = req.user.id;
        const result = await pool.query(
            `SELECT a.id, a.date, a.start_time, a.status, a.created_at,
                    s.name as service_name, s.duration,
                    u.first_name as employee_first_name, u.last_name as employee_last_name
             FROM appointments a
             JOIN services s ON a.service_id = s.id
             JOIN users u ON a.employee_id = u.id
             WHERE a.client_id = $1 AND a.status != 'cancelled'
             ORDER BY a.date DESC, a.start_time DESC`,
            [user_id]
        );

        res.json({
            success: true,
            result: result.rows
        });

    } catch (error) {
        console.error('Error fetching user appointments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
};

exports.getWeeklyEmployeeAppointments = async (req, res) => {
    try {
      
      const { employeeId, startDay, endDay } = req.query;
  
      if (!employeeId || !startDay || !endDay) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
  
      if ( isNaN(Date.parse(startDay)) ) {
        return res.status(400).json({ error: 'Invalid start date format' });
      }
  
        const query = `
        SELECT 
            a.id,
            a.date,
            a.start_time,
            (a.start_time + (s.duration * INTERVAL '1 minute')) AS end_time,
            a.status,
            s.id AS service_id,
            s.name AS service_name,
            s.duration,
            u.id AS client_id,
            u.first_name AS client_first_name,
            u.last_name AS client_last_name
        FROM Appointments a
        JOIN Services s ON a.service_id = s.id
        JOIN Users u ON a.client_id = u.id
        WHERE a.employee_id = $1
            AND a.date BETWEEN $2 AND $3
            AND a.status IN ('pending', 'confirmed')
        ORDER BY a.date ASC, a.start_time ASC
        `;

        const { rows } = await pool.query(query, [employeeId, startDay, endDay]);

        const appointments = rows.map(row => ({
        id: row.id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        service: {
            id: row.service_id,
            name: row.service_name,
            duration: row.duration
        },
        client: {
            id: row.client_id,
            name: `${row.client_first_name} ${row.client_last_name}`
        }
        }));

        res.json({ 
            success: true,
            result: appointments
             });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
  };


exports.getPersonalEmployeeAppointments = async (req, res) => {
    try {
      
      const { startDay, endDay } = req.query;
      const employeeId = req.user.id;

      if (!employeeId || !startDay || !endDay) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
  
      if ( isNaN(Date.parse(startDay)) ) {
        return res.status(400).json({ error: 'Invalid start date format' });
      }
  
        const query = `
        SELECT 
            a.id,
            a.date,
            a.start_time,
            (a.start_time + (s.duration * INTERVAL '1 minute')) AS end_time,
            a.status,
            s.id AS service_id,
            s.name AS service_name,
            s.duration,
            u.id AS client_id,
            u.first_name AS client_first_name,
            u.last_name AS client_last_name
        FROM Appointments a
        JOIN Services s ON a.service_id = s.id
        JOIN Users u ON a.client_id = u.id
        WHERE a.employee_id = $1
            AND a.date BETWEEN $2 AND $3
            AND a.status IN ('pending', 'confirmed')
        ORDER BY a.date ASC, a.start_time ASC
        `;

        const { rows } = await pool.query(query, [employeeId, startDay, endDay]);

        const appointments = rows.map(row => ({
        id: row.id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        service: {
            id: row.service_id,
            name: row.service_name,
            duration: row.duration
        },
        client: {
            id: row.client_id,
            name: `${row.client_first_name} ${row.client_last_name}`
        }
        }));

        res.json({ 
            success: true,
            result: appointments
             });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
  };


exports.getEmployeeAppointments = async (req, res) => {
    try {

        const isAdmin = req.user.role === 2; 
        const queryParams = [];
        let query = `
            SELECT a.id, a.date, a.start_time, a.status, a.created_at,
                   s.name as service_name, s.duration,
                   c.first_name as client_first_name, c.last_name as client_last_name,
                   e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM appointments a
            JOIN services s ON a.service_id = s.id
            JOIN users c ON a.client_id = c.id
            JOIN users e ON a.employee_id = e.id
        `;

        if (!isAdmin) {
            query += ' WHERE a.employee_id = $1';
            queryParams.push(req.user.id);
        }

        query += ' ORDER BY a.date DESC, a.start_time DESC';

        const result = await pool.query(query, queryParams);

        res.json({
            success: true,
            appointments: result.rows
        });

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
};

exports.updateAppointment = [
    body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Invalid status'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { appointmentID } = req.params;
            const { status } = req.body;

            // Verify appointment exists and belongs to employee (or is admin)
            const appointment = await pool.query(
                `SELECT employee_id FROM appointments WHERE id = $1`,
                [appointmentID]
            );

            if (appointment.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Appointment not found' 
                });
            }

            // Authorization check - employee can only update their own appointments
            if (req.user.role !== 2 && appointment.rows[0].employee_id !== req.user.id) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Unauthorized to update this appointment' 
                });
            }

            // Update status
            const result = await pool.query(
                `UPDATE appointments 
                 SET status = $1
                 WHERE id = $2
                 RETURNING id, status, date, start_time`,
                [status, appointmentID]
            );

            res.json({
                success: true,
                appointment: result.rows[0]
            });

        } catch (error) {
            console.error('Error updating appointment:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to update appointment' 
            });
        }
    }
];


exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentID } = req.params;

        // Verify appointment exists and belongs to user
        const appointment = await pool.query(
            `SELECT client_id, employee_id, status FROM appointments WHERE id = $1`,
            [appointmentID]
        );

        if (appointment.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Appointment not found' 
            });
        }

        // Authorization check:
        // - Client can cancel their own appointments
        // - Employee can cancel their own appointments
        // - Admin can cancel any appointment
        const isClient = appointment.rows[0].client_id === req.user.id;
        const isEmployee = appointment.rows[0].employee_id === req.user.id;
        const isAdmin = req.user.role === 2; 

        if (!isClient && !isEmployee && !isAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized to cancel this appointment' 
            });
        }

        if (['completed', 'cancelled'].includes(appointment.rows[0].status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot cancel already completed or cancelled appointment' 
            });
        }

        // Cancel appointment
        const result = await pool.query(
            `UPDATE appointments 
             SET status = 'cancelled'
             WHERE id = $1
             RETURNING id, status`,
            [appointmentID]
        );

        res.json({
            success: true,
            message: 'Appointment cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to cancel appointment' 
        });
    }
};