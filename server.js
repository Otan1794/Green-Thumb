const express = require('express');
const session = require('express-session');
const moment = require('moment-timezone');
const path = require("path");
const axios = require('axios');
const app = express();
const bodyParser = require('body-parser');
const server = app.listen(1337);
const io = require('socket.io')(server);
const mysql = require('mysql');


const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const enrollStrings = [
    "Ready to enroll a fingerprint!",
    "Please place your finger on the scanner...",
    "Image taken",
    "Communication error",
    "Imaging error",
    "Unknown error",
    "Image converted",
    "Image too messy",
    "Could not find fingerprint features",
    "Remove finger",
    "Place same finger again",
    "Creating model...",
    "Prints matched!",
    "Fingerprints did not match",
    "Stored!",
    "Could not store in that location",
    "Error writing to flash"
];

const port = new SerialPort({
    path: 'COM3',
    baudRate: 9600
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

app.use(session({
    secret: 'keyboardkitteh',
    resave: false,
    saveUninitialized: true
}));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'sensor_data'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL server');
    
});

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "./static")));

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

const recordingStatus = {
    isRecordingLight: 0,
    isRecordingTemp: 0,
    isRecordingHum: 0
};

app.get('/', function(req, res) {
    res.render("index");
});

io.on('connection', function(socket) {
    // console.log(socket.id);

    socket.on('submitDateFormLight', function(formData) {
        console.log('Received form data Light: ', formData);
        const { startdatetime, enddatetime } = parseFormData(formData);
        console.log('Parsed start datetime:', startdatetime);
        console.log('Parsed end datetime:', enddatetime);
        getDataByDateRange(startdatetime, enddatetime, 'light')
        .then(lightData => {
            io.emit('lightGraphData', lightData);
        })
        .catch(err => {
            console.error('Error fetching light data:', err);
        });
    });

    socket.on('submitDateFormTemperature', function(formData) {
        console.log('Received form data Temperature: ', formData);
        const { startdatetime, enddatetime } = parseFormData(formData);
        console.log('Parsed start datetime:', startdatetime);
        console.log('Parsed end datetime:', enddatetime);
        getDataByDateRange(startdatetime, enddatetime, 'temperature')
        .then(temperatureData => {
            io.emit('temperatureGraphData', temperatureData);
        })
        .catch(err => {
            console.error('Error fetching temperature data:', err);
        });
    });

    socket.on('submitDateFormHumidity', function(formData) {
        console.log('Received form data Humidity: ', formData);
        const { startdatetime, enddatetime } = parseFormData(formData);
        console.log('Parsed start datetime:', startdatetime);
        console.log('Parsed end datetime:', enddatetime);
        getDataByDateRange(startdatetime, enddatetime, 'humidity')
        .then(humidityData => {
            io.emit('humidityGraphData', humidityData);
        })
        .catch(err => {
            console.error('Error fetching humidity data:', err);
        });
    });

    socket.on('login', async function(data) {
        console.log('ID is: ' + data);
        try {
            const userData = await getUsersData(data);
            console.log('User data:', userData);
            io.emit('userData', userData);
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    });

    socket.on('register_user', function(data) {
        console.log(data);
        port.write(data + '\n');
    });

    socket.on('registerDB', async function(data) {
        console.log(data);
        const { first_name, last_name, location } = data;
    
        try {
            await insertUserData(first_name, last_name, location);
            console.log('Data inserted into database');
            socket.emit('registrationSuccess', { message: 'Registration successful' });
        } catch (error) {
            console.error('Error inserting data into database:', error);
            socket.emit('registrationError', { error: 'Error inserting data into database' });
        }
    });

    socket.on('update_user', async function({ userId, formData }) {
        console.log('Received update request for user ID:', userId);
        console.log('Form data:', formData);
        
        const parsedFormData = parseUserData(formData);
    
        const { first_name, last_name, location } = parsedFormData;
    
        try {
            await updateUserInDatabase(userId, { first_name, last_name, location });
            console.log('User information updated successfully');
        } catch (error) {
            console.error('Error updating user information:', error);
        }
    });

    socket.on('recordLight', function(isRecording) {
        if (isRecording) {
            console.log('Light Recording started');
            recordingStatus.isRecordingLight = 1;
        } else {
            console.log('Light Recording stopped');
            recordingStatus.isRecordingLight = 0;
        }
    });

    socket.on('recordTemp', function(isRecording) {
        if (isRecording) {
            console.log('Temperature Recording started');
            recordingStatus.isRecordingTemp = 1;
        } else {
            console.log('Temperature Recording stopped');
            recordingStatus.isRecordingTemp = 0;
        }
    });

    socket.on('recordHum', function(isRecording) {
        if (isRecording) {
            console.log('Humidity Recording started');
            recordingStatus.isRecordingHum = 1;
        } else {
            console.log('Humidity Recording stopped');
            recordingStatus.isRecordingHum = 0;
        }
    });
});

parser.on("data", function(data) {
    // console.log(data);
    const parsedData = parseData(data);
    if (!parsedData) {
        const parsedFingerprint = parseFingerprint(data);
        // console.log(parsedFingerprint);
        io.emit('fingerprint', parsedFingerprint);
    }
    if(parsedData) {
        insertIntoDatabase(parsedData);
    } else {
        console.log('No parsed data yet');
    }
    io.emit('data', parsedData);

    if(enrollStrings.includes(data)) {
        console.log(data);
        io.emit('enroll_fingerprint', data);
    }

});

function parseData(rawData) {
    const regex = /Light: (\d+\.\d+)lx, Humidity: (\d+\.\d+) %, Temp: (\d+\.\d+) Celsius/;
    const match = rawData.match(regex);

    if (match) {
        return {
            lightIntensity: parseFloat(match[1]),
            humidity: parseFloat(match[2]),
            temperature: parseFloat(match[3])
        };
    } else {
        return null; 
    }
}

function parseFingerprint(rawData) {
    const match = rawData.match(/Fingerprint ID #(\d+)/);

    if (match) {
        const fingerprintID = parseInt(match[1]);
        return {
            fingerprintID,
            status: "Match"
        };
    } else {
        return {
            status: "Not Match",
            message: "Fingerprint not found"
        };
    }
}

function insertIntoDatabase(data) {

    const insertTemperature = () => {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO temperature (value, created_at) VALUES (?, NOW())';
            connection.query(sql, [data.temperature], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Temperature data inserted:', result);
                    resolve();
                }
            });
        });
    };

    const insertHumidity = () => {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO humidity (value, created_at) VALUES (?, NOW())';
            connection.query(sql, [data.humidity], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Humidity data inserted:', result);
                    resolve();
                }
            });
        });
    };
    
    const insertLight = () => {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO light (value, created_at) VALUES (?, NOW())';
            connection.query(sql, [data.lightIntensity], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Light data inserted:', result);
                    resolve();
                }
            });
        });
    };

    (async () => {
        try {
            if(recordingStatus.isRecordingTemp) {
                await insertTemperature();
            }
            if(recordingStatus.isRecordingHum) {
                await insertHumidity();
            }
            if(recordingStatus.isRecordingLight) {
                await insertLight();
            }
        } catch (error) {
            console.error('Error inserting data:', error);
        }
    })();
}

function parseFormData(formData) {
    const decodedFormData = decodeURIComponent(formData);
    const params = new URLSearchParams(decodedFormData);
    const startdatetime = params.get('startdatetime');
    const enddatetime = params.get('enddatetime');

    // Parse the date and time strings into a format MySQL understands
    const parsedStartDatetime = moment(startdatetime).format('YYYY-MM-DD HH:mm:ss');
    const parsedEndDatetime = moment(enddatetime).format('YYYY-MM-DD HH:mm:ss');

    return { startdatetime: parsedStartDatetime, enddatetime: parsedEndDatetime };
}

function parseUserData(formData) {
    const params = new URLSearchParams(formData);
    const parsedData = {};
    for (const [key, value] of params) {
        parsedData[key] = value;
    }
    return parsedData;
}

async function getUsersData(userId) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM users WHERE user_id = ?';
        connection.query(sql, [userId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

async function insertUserData(first_name, last_name, location) {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO users (first_name, last_name, location, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())';
        const values = [first_name, last_name, location];
        connection.query(sql, values, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function updateUserInDatabase(userId, userData) {
    try {
        console.log('Updating user information in the database:', userId, userData);

        const sql = 'UPDATE users SET first_name = ?, last_name = ?, location = ?, updated_at = NOW() WHERE user_id = ?';
        const values = [userData.first_name, userData.last_name, userData.location, userId];

        const result = await new Promise((resolve, reject) => {
            connection.query(sql, values, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('User information updated:', result);
                    resolve(result);
                }
            });
        });

        return result;
    } catch (error) {
        console.error('Error updating user information:', error);
        throw error;
    }
}

function getDataByDateRange(startDate, endDate, sensor_table) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM ${sensor_table} WHERE created_at BETWEEN ? AND ?`;
        const values = [startDate, endDate];

        connection.query(sql, values, (err, results) => {
            if (err) {
                reject(err);
            } else {
                const formattedResults = results.map(row => ({
                    ...row,
                    created_at: moment(row.created_at).format('YYYY-MM-DD HH:mm:ss')
                }));
                resolve(formattedResults);
            }
        });
    });
}