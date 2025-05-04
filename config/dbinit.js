const { Client } = require("pg");
require("dotenv").config();

const SQL = `

CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR (20),
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role INT NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration INT NOT NULL CHECK (duration > 0), -- Duración en minutos
    description TEXT,
    price INT NOT NULL
);

CREATE TABLE Availability (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES Users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (employee_id, date, start_time)
);

CREATE TABLE Appointments (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES Users(id) ON DELETE CASCADE,
    employee_id INT REFERENCES Users(id) ON DELETE CASCADE,
    service_id INT REFERENCES Services(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Attendance (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES Users(id) ON DELETE CASCADE,
    total_appointments INT DEFAULT 0,
    missed_appointments INT DEFAULT 0,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE EmployeeServices (
    employee_id INT REFERENCES Users(id) ON DELETE CASCADE,
    service_id INT REFERENCES Services(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, service_id)  
);

`;

async function main() {
    console.log("Seeding database...");
    const client = new Client({
        connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
    });
    await client.connect();
    await client.query(SQL);
    await client.end();
    console.log("Database initialized successfully!");
}

main();
