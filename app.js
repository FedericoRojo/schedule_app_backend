/*
Potencial error: ahora estoy usando 'cliente' y 'empleado' en role. Posiblemente lo cambie. Y esa definición la use en
el userMiddleware. Por lo que si lo cambio tengo que cambiar tambien la definición usada en el middleware
*/


const express = require("express");
const passport = require('passport');
const userRouter = require("./routes/userRouter");
const serviceRouter = require("./routes/serviceRouter");
const availabilityRouter = require("./routes/availabilityRouter");
//const attendaceRouter = require("./routes/attendaceRouter");
const appointmentRouter = require("./routes/appointmentRouter");
const cors = require('cors');
require("dotenv").config();

var app = express();

require('./config/passport')(passport);
app.use(passport.initialize());

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());

app.use('/users', userRouter);
app.use('/services', serviceRouter);
app.use('/availability', availabilityRouter);
//app.use('/attendace', attendaceRouter);
app.use('/appointment', appointmentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App running on PORT ${PORT}`));
