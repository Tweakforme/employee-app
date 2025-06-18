const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const { Sequelize, DataTypes, Op } = require('sequelize');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const ejs = require("ejs");
const fs = require('fs');
const XlsxPopulate = require("xlsx-populate");
const axios = require("axios");
require('dotenv').config();
const nodeCron = require('node-cron');
const { DateTime } = require("luxon");

const app = express();
const PORT = 3001;

// ======================== MySQL Database Connection ========================
const sequelize = new Sequelize('workhours_db', 'hodder', 'romeo10', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false,
});

sequelize.authenticate()
    .then(() => console.log('? Connected to MySQL successfully.'))
    .catch(err => console.error('? Unable to connect to MySQL:', err));

// ======================== Define User Table ========================
const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'user', // Default role is 'user'
    },
}, {
    tableName: 'user',
    timestamps: false
});

// ======================== Define Work Hours Table ========================
const WorkHour = sequelize.define('WorkHour', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    employee_id: {
        type: DataTypes.STRING, 
        allowNull: false,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
projects: {
  type: DataTypes.JSON,
  allowNull: true
},
    hours_worked: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true,  
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    signature: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'WorkHours',
    timestamps: true,
});

// ======================== Define Employee Table ========================
const Employee = sequelize.define('Employee', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    signature: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    last_logged: {
        type: DataTypes.DATE,
        allowNull: true
    },
    full_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pronouns: {
        type: DataTypes.STRING,
        allowNull: true
    },
    department: {
        type: DataTypes.STRING,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tshirt_size: {
        type: DataTypes.STRING,
        allowNull: true
    },
    emergency_contact_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    emergency_contact_phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
}, {
    tableName: 'employees',
    timestamps: false
});

// ======================== Define Relationships ========================
Employee.hasMany(WorkHour, { foreignKey: 'employee_id' });
WorkHour.belongsTo(Employee, { foreignKey: 'employee_id', targetKey: 'id' });

// ======================== Sync Database ========================
sequelize.sync()
    .then(() => console.log('? Database & tables created!'))
    .catch(err => console.error('? Error syncing database:', err));

module.exports = { sequelize, User, WorkHour, Employee }; 

// ======================== Middleware ========================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // Ensure it's before routes
app.use(express.json());
app.use('/signatures', express.static(path.join(__dirname, 'signatures')));


app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key', // Load from .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set `true` if using HTTPS
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ======================== Authentication Middleware ========================
const isAuthenticated = (req, res, next) => {
    if (!req.session.username) {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        return res.redirect('/login');
    }
    next();
};

// ======================== Ensure Upload Directory Exists ========================
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true }); // Ensures no race conditions

// ======================== Configure Multer for Image Uploads ========================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, "_");
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /\.(jpg|jpeg|png|gif)$/i;
    if (!allowedTypes.test(file.originalname)) {
        return cb(new Error('Only image files (JPG, PNG, GIF) are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});


// ======================== Routes ========================

// Home Route
app.get('/', (req, res) => {
    if (req.session.username) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Delete All Work Hours (Admin Only)
app.get('/delete-all-hours', isAuthenticated, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send("Unauthorized: Admins only.");
        }

        await WorkHour.destroy({ where: {}, truncate: true });

        console.log("? All work hours deleted manually.");
        res.send("All logged work hours have been deleted successfully!");
    } catch (error) {
        console.error("? Error deleting work hours:", error);
        res.status(500).send("Error deleting all work hours!");
    }
});

// Login Form Submission
app.post('/login', async (req, res) => {
    console.log("Login request received"); // Log request start

    const { username, password } = req.body;
    console.log(`? Attempting login for: ${username}`);

    try {
        const user = await User.findOne({ where: { username } });

        if (!user) {
            console.log("User not found!");
            return res.render('login', { error: 'Invalid username or password' });
        }

        console.log("User found, checking password...");
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            console.log("Password does not match!");
            return res.render('login', { error: 'Invalid username or password' });
        }

        console.log("Password correct, setting session...");
        req.session.username = username;
        req.session.role = user.role;
        req.session.userId = user.id;

        console.log("Redirecting to dashboard...");
        return res.redirect('/dashboard'); // Ensure a response is always sent
    } catch (error) {
        console.error("Error during login:", error);
        return res.render('login', { error: 'Something went wrong!' });
    }
});

// Dashboard Route - Fetch Work Hours
app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        const role = req.session.role;

        // Explicitly include 'full_name' in attributes
        const employee = await Employee.findOne({
            where: { name: username },
            attributes: ['id', 'name', 'signature', 'full_name'], 
            raw: false
        });

        const fullName = employee?.get('full_name') || username;

        console.log("Session username:", username);
        console.log("Matched employee record:", employee);
        console.log("Resolved full name:", fullName);

        const workHours = await WorkHour.findAll({
            where: { employee_id: username },
            order: [['date', 'DESC']],
        });

        res.render('dashboard', { username, fullName, role, workHours });

    } catch (error) {
        console.error("? Error fetching work hours:", error);
        res.render('dashboard', {
            username: req.session.username,
            fullName: req.session.username,
            role: req.session.role,
            workHours: []
        });
    }
});

// ======================== Serve Forms ========================

// ?? Reusable function to initialize form data
const initializeFormData = (fields) => {
    return fields.reduce((acc, field) => {
        acc[field] = "";
        return acc;
    }, {});
};

// Serve Form 1 (Furnace Service Report)
app.get('/form1', isAuthenticated, (req, res) => {
    const formData = {
        ...initializeFormData([
            "serviceDate", "technician", "customerName", "customerAddress", "contactNumber",
            "furnaceMake", "furnaceModel", "furnaceSerialNumber", "furnaceYearInstalled",
            "typeOfFuel", "upflowDownflow", "dimensions", "additionalNotes"
        ]),
        picture1: null, picture2: null, picture3: null,
        checkThermostat: false, inspectFilters: false, checkGasLeaks: false, inspectVents: false,
        inspectAirflow: false, cleanAirFilters: false, cleanBlowerAssembly: false,
        cleanBurners: false, inspectFluePipe: false, lubricateParts: false,
        testSafetyControls: false, inspectCO: false, checkCombustion: false,
        testIgnition: false, verifyThermostat: false, checkOverallSystem: false,
        provideMaintenanceTips: false
    };

    console.log("? Rendering Form 1");
    res.render('form1', { formData });
});

// Serve Form 2 (AC Service Report)
app.get('/form2', isAuthenticated, (req, res) => {
    const formData = {
        ...initializeFormData([
            "serviceDate", "technician", "customerName", "customerAddress", "contactNumber",
            "acMake", "acModel", "acSerialNumber", "acYearInstalled", "acOrHeatPump",
            "additionalNotes"
        ]),
        picture1: null, picture2: null, picture3: null,
        checkThermostat: false, inspectFilters: false, checkRefrigerantLevels: false,
        inspectDuctwork: false, cleanAirFilters: false, cleanCondenserCoils: false,
        cleanEvaporatorCoils: false, checkDrainLine: false, testSafetyControls: false,
        inspectElectricalConnections: false, checkCompressorOperation: false,
        testOverallSystem: false, verifyThermostatCalibration: false, provideMaintenanceTips: false
    };

    console.log("Rendering Form 2");
    res.render('form2', { formData });
});

// Serve Form 3 (Plumbing Service Report)
app.get('/form3', isAuthenticated, (req, res) => {
    const formData = {
        ...initializeFormData([
            "inspectionDate", "inspectorName", "customerName", "customerAddress", "contactNumber",
            "propertyType", "bathrooms", "kitchens", "yearBuilt", "plumbingCondition", "leakSigns",
            "waterPressure", "kitchenSink", "kitchenFaucet", "kitchenDishwasher",
            "bathroomSink", "bathroomFaucet", "bathroomToilet", "bathroomShowerTub"
        ])
    };

    console.log("Rendering Form 3");
    res.render('form3', { formData });
});

// Serve Form 4 
app.get('/form4', isAuthenticated, (req, res) => {
    const formData = {
        inspection_date: "",
        project_name: "",
        job_site_location: "",
        inspector_name: "",
        weather_conditions: "",
        additional_comments: "",
        inspector_signature: "",
    };

    // Ensure all sections & checkboxes exist in formData
    const sections = [
        "General_Site_Conditions",
        "Personal_Protective_Equipment_(PPE)",
        "Tools_&_Equipment",
        "Fall_Protection",
        "Electrical_Safety",
        "Heavy_Equipment_&_Vehicles",
        "Fire_&_Hazardous_Materials",
        "Emergency_Preparedness"
    ];

    // Initialize checkboxes as unchecked
    sections.forEach(section => {
        for (let i = 0; i < 5; i++) {
            formData[`${section}_${i}`] = "";
        }
    });

    res.render('form4', { formData });
});

// ======================== Form 1 (Furnace Service Report) Submission ========================
app.post("/submit-service-form", isAuthenticated, upload.fields([
    { name: "picture1", maxCount: 1 },
    { name: "picture2", maxCount: 1 },
    { name: "picture3", maxCount: 1 }
]), async (req, res) => {
    try {
        console.log("?? Received Form 1 Data:", req.body);
        console.log("?? Received Files:", req.files);

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send("? Error: Form data is missing.");
        }

        // ? List of checkboxes
        const checkboxFields = [
            "checkThermostat", "inspectFilters", "checkGasLeaks", "inspectVents", "inspectAirflow",
            "cleanAirFilters", "cleanBlowerAssembly", "cleanBurners", "inspectFluePipe",
            "lubricateParts", "testSafetyControls", "inspectCO", "checkCombustion",
            "testIgnition", "verifyThermostat", "checkOverallSystem", "provideMaintenanceTips"
        ];

        // ? Process checkboxes efficiently
        const checkboxData = checkboxFields.reduce((acc, field) => {
            acc[field] = req.body[field] === "on"; // Convert "on" to true, otherwise false
            return acc;
        }, {});

        // ? Handle file uploads safely
        const uploadedFiles = req.files || {};
        const getFilePath = (fileField) => uploadedFiles[fileField]?.[0]?.path || null;

        // ? Construct final form data
        const formData = {
            ...req.body,
            ...checkboxData,
            picture1: getFilePath("picture1"),
            picture2: getFilePath("picture2"),
            picture3: getFilePath("picture3"),
        };

        console.log("?? Processed Form Data:", formData);

        // ? Send to PDF generator
        await generateAndSendPDF(formData, "form1.ejs", "Furnace Report", res, req.session.username);
    } catch (error) {
        console.error("? Error processing Form 1 submission:", error);
        res.status(500).send(`? Error processing form submission: ${error.message}`);
    }
});


// ======================== Form 2 (AC Service Report) Submission ========================
app.post("/submit-ac-service-form", isAuthenticated, upload.fields([
    { name: "picture1", maxCount: 1 },
    { name: "picture2", maxCount: 1 },
    { name: "picture3", maxCount: 1 }
]), async (req, res) => {
    try {
        console.log("?? Received Form 2 Data:", req.body);
        console.log("?? Received Files:", req.files);

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send("? Error: Form data is missing.");
        }

        // ? List of checkboxes
        const checkboxFields = [
            "checkThermostat", "inspectFilters", "checkRefrigerantLevels", "inspectDuctwork",
            "cleanAirFilters", "cleanCondenserCoils", "cleanEvaporatorCoils", "checkDrainLine",
            "testSafetyControls", "inspectElectricalConnections", "checkCompressorOperation",
            "testOverallSystem", "verifyThermostatCalibration", "provideMaintenanceTips"
        ];

        // ? Process checkboxes efficiently
        const checkboxData = checkboxFields.reduce((acc, field) => {
            acc[field] = req.body[field] === "on"; // Convert "on" to true, otherwise false
            return acc;
        }, {});

        // ? Handle file uploads safely
        const uploadedFiles = req.files || {};
        const getFilePath = (fileField) => uploadedFiles[fileField]?.[0]?.path || null;

        // ? Construct final form data
        const formData = {
            ...req.body,
            ...checkboxData,
            picture1: getFilePath("picture1"),
            picture2: getFilePath("picture2"),
            picture3: getFilePath("picture3"),
        };

        console.log("?? Processed Form Data:", formData);

        // ? Send to PDF generator
        await generateAndSendPDF(formData, "form2.ejs", "AC Service Report", res, req.session.username);
    } catch (error) {
        console.error("? Error processing Form 2 submission:", error);
        res.status(500).send(`? Error processing AC Service Report: ${error.message}`);
    }
});

// ======================== Form 3 (Plumbing Report) Submission ========================
app.post("/submit-plumbing-report", isAuthenticated, upload.fields([
    { name: "picture1", maxCount: 1 },
    { name: "picture2", maxCount: 1 },
    { name: "picture3", maxCount: 1 }
]), async (req, res) => {
    try {
        console.log("?? Received Plumbing Report Data:", req.body);
        console.log("?? Received Files:", req.files);

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send("? Error: Form data is missing.");
        }

        // ? Define all checkbox fields
        const checkboxFields = [
            "checkLeaks", "inspectPipes", "testWaterPressure", "inspectFaucets",
            "inspectToilets", "checkSinks", "checkShowerDrainage", "inspectValves"
        ];

        // ? Process checkboxes efficiently
        const checkboxData = checkboxFields.reduce((acc, field) => {
            acc[field] = req.body[field] === "on"; // Convert "on" to true, otherwise false
            return acc;
        }, {});

        // ? Handle file uploads safely
        const uploadedFiles = req.files || {};
        const getFilePath = (fileField) => uploadedFiles[fileField]?.[0]?.path || null;

        // ? Construct final form data
        const formData = {
            ...req.body,
            ...checkboxData,
            picture1: getFilePath("picture1"),
            picture2: getFilePath("picture2"),
            picture3: getFilePath("picture3"),
        };

        console.log("?? Processed Plumbing Report Data:", formData);

        // ? Send to PDF generator
        await generateAndSendPDF(formData, "form3.ejs", "Plumbing Report", res, req.session.username);
    } catch (error) {
        console.error("? Error processing Plumbing Report submission:", error);
        res.status(500).send(`? Error processing Plumbing Report: ${error.message}`);
    }
});

// Form 4 Submission
app.post('/submit-form4', isAuthenticated, async (req, res) => {
    try {
        console.log("? Form 4 Submission Attempted!"); // Log before accessing formData

        const formData = req.body;
        console.log("?? Form Data Received:", JSON.stringify(formData, null, 2));

        // Generate PDF and send email
        await generateAndSendPDF(formData, "form4.ejs", "Construction Job Site Inspection Report", res);
    } catch (error) {
        console.error("Error processing Form 4:", error);
        res.status(500).send("Error processing Form 4.");
    }
});

// ======================== Work Hours Page with Pagination ========================
app.get('/work-hours', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        const role = req.session.role || "user";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        if (!username) {
            console.error("? Session missing username");
            return res.status(401).send("Unauthorized");
        }

        // Fetch employee
        const employee = await Employee.findOne({ where: { name: username } });
        if (!employee) {
            console.error("? Employee not found for:", username);
            return res.status(404).send("Employee not found.");
        }

        // Fetch up to 30 latest entries
        const allEntries = await WorkHour.findAll({
            where: { employee_id: employee.id },
            order: [['date', 'DESC']],
            limit: 30
        });

        // Paginate entries (10 per page)
        const totalPages = Math.ceil(allEntries.length / limit);
        const workHoursPage = allEntries.slice(offset, offset + limit);

        // Parse projects safely
        const workHoursData = workHoursPage.map(entry => {
            let projects = [];
            try {
                const raw = entry.projects;

                if (typeof raw === "string") {
                    let parsed = JSON.parse(raw);
                    if (typeof parsed === "string") parsed = JSON.parse(parsed); // Handle double-stringified
                    projects = Array.isArray(parsed) ? parsed : [parsed];
                } else if (Array.isArray(raw)) {
                    projects = raw;
                } else if (typeof raw === "object" && raw !== null) {
                    projects = [raw];
                } else {
                    projects = [];
                }
            } catch (err) {
                console.error("? Failed to parse projects for entry ID:", entry.id, err);
                projects = [];
            }

            return { ...entry.toJSON(), projects };
        });

        // Date limits (today and yesterday)
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const format = (d) => d.toISOString().split("T")[0];
        const minDate = format(yesterday);
        const maxDate = format(today);

        const lastLoggedEntry = workHoursData[0] || null;
        const lastLogged = lastLoggedEntry ? lastLoggedEntry.date : null;

    res.render('work-hours', {
  workHours: workHoursData,
  user: { username, role },
  lastLogged,
  minDate,
  maxDate,
  currentPage: page,
  totalPages,
  DateTime 
});


    } catch (err) {
        console.error("?? Error fetching work hours:", err);
        return res.status(500).send("Server error: " + err.message);
    }
});


// Admin Only - Fetch All Work Hours
app.get('/admin/all-work-hours', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        const role = req.session.role || "user";

        if (role !== "admin") {
            return res.status(403).send("Unauthorized: Admins only.");
        }

        // Fetch all employees for dropdown
        const employees = await Employee.findAll({
            attributes: ['id', 'name', 'full_name']
        });

        // Fetch all work hours and include Employee data
        const workHours = await WorkHour.findAll({
            attributes: ['id', 'employee_id', 'date', 'projects', 'hours_worked', 'description'],
            include: [{
                model: Employee,
                attributes: ['id', 'name']
            }],
            order: [['employee_id', 'ASC'], ['date', 'DESC']]
        });

        // Safely parse projects (including double-encoded edge case)
        const parsedWorkHours = workHours.map(entry => {
            let projects = [];
            try {
                const raw = entry.projects;

                if (typeof raw === "string") {
                    let parsed = JSON.parse(raw);
                    if (typeof parsed === "string") parsed = JSON.parse(parsed); // handle double-stringified
                    projects = Array.isArray(parsed) ? parsed : [parsed];
                } else if (Array.isArray(raw)) {
                    projects = raw;
                } else if (typeof raw === "object" && raw !== null) {
                    projects = [raw];
                }
            } catch (error) {
                console.error("? Error parsing projects for entry ID:", entry.id, error);
                projects = [];
            }

            return { ...entry.toJSON(), projects };
        });

        res.render('admin-work-hours', {
            workHours: parsedWorkHours,
            user: { username, role },
            employees
        });

    } catch (error) {
        console.error("Error loading all work hours:", error);
        res.render('admin-work-hours', {
            workHours: [],
            user: null,
            employees: [],
            message: "Error fetching all work hours!"
        });
    }
});

app.get('/admin/log-hours/:employeeId', isAuthenticated, async (req, res) => {
    const { employeeId } = req.params;
    const role = req.session.role;

    if (role !== "admin") {
        return res.status(403).send("Unauthorized: Admins only.");
    }

    try {
        const employee = await Employee.findOne({ where: { id: employeeId } });
        if (!employee) {
            return res.status(404).send("Employee not found");
        }

        res.render("admin-log-hours", {
            employeeName: employee.full_name || employee.name,
            employeeId: employee.id,
        });
    } catch (err) {
        console.error("Error fetching employee for log-hours:", err);
        res.status(500).send("Server error");
    }
});

// Admin logs hours for a selected employee
app.post('/admin/log-hours', isAuthenticated, async (req, res) => {
    const role = req.session.role;
    if (role !== "admin") {
        return res.status(403).send("Unauthorized: Admins only.");
    }

    try {
        const {
            employee_id,
            date,
            project_name,
            location,
            hours_worked,
            description,
            signatureData
        } = req.body;

        const employee = await Employee.findByPk(employee_id);
        if (!employee) {
            return res.status(404).send("Employee not found.");
        }

        // Format project data
        const projects = [{
            name: project_name,
            location,
            hours: parseFloat(hours_worked),
            description: description || "N/A"
        }];

        // Save signature if provided
        let signaturePath = null;
        if (signatureData) {
            const base64Data = signatureData.replace(/^data:image\/png;base64,/, "");
            const fileName = `${employee.name}_${Date.now()}.png`;
            signaturePath = `signatures/${fileName}`;
            const filePath = path.join(__dirname, signaturePath);
            fs.writeFileSync(filePath, base64Data, 'base64');
        }

        // Create or update WorkHour entry
        const existingEntry = await WorkHour.findOne({
            where: {
                employee_id,
                date
            }
        });

        if (existingEntry) {
            // Append projects
            let existingProjects = [];
            try {
                existingProjects = existingEntry.projects ? JSON.parse(existingEntry.projects) : [];
            } catch (e) {
                existingProjects = [];
            }

            existingProjects.push(...projects);

            await existingEntry.update({
                projects: JSON.stringify(existingProjects),
                hours_worked: existingProjects.reduce((sum, p) => sum + (p.hours || 0), 0),
                description: existingProjects.map(p => `${p.name}: ${p.description}`).join("; ")
            });
        } else {
            await WorkHour.create({
                employee_id,
                date,
                projects,
                hours_worked: parseFloat(hours_worked),
                description,
                signature: signaturePath
            });
        }

        res.redirect('/admin/all-work-hours');
    } catch (err) {
        console.error("Admin log-hours failed:", err);
        res.status(500).send("Server error while logging hours.");
    }
});


// ======================== Log Work Hours with Signature ========================

app.post("/log-hours", isAuthenticated, async (req, res) => {
    try {
        const { date, project_name, location, hours_worked, description, signatureData } = req.body;
        const username = req.session.username;

        console.log("DEBUG: Received Work Hours Data:", req.body);

        if (!username) {
            console.error("User session is missing.");
            return res.status(401).send("User not authenticated!");
        }

// Get current time in Pacific Time
const now = DateTime.now().setZone("America/Vancouver");

// Parse the submitted date in Pacific Time
const logDate = DateTime.fromISO(date, { zone: "America/Vancouver" }).startOf("day");

// Deadline = start of log date + 48 hours
const deadline = logDate.plus({ hours: 48 });

// Check if current time is still within logging window
if (now > deadline) {
    console.error("? Logging window expired for:", date);
    return res.status(400).send("Logging window expired for that day.");
}

        const employee = await Employee.findOne({ where: { name: username } });
        if (!employee) {
            console.error("Employee record not found for:", username);
            return res.status(404).send("Employee record not found!");
        }

        console.log("Found Employee ID:", employee.id);

        let workHourEntry = await WorkHour.findOne({ where: { employee_id: employee.id, date: logDate.toISODate() } });


        let projects = [];
        if (Array.isArray(project_name)) {
            projects = project_name.map((name, index) => ({
                name,
                location: location[index],
                hours: parseFloat(hours_worked[index]) || 0,
                description: description[index] || "N/A"
            }));
        } else {
            projects = [{
                name: project_name,
                location,
                hours: parseFloat(hours_worked) || 0,
                description: description || "N/A"
            }];
        }

        console.log("DEBUG: Processed Projects Before Saving:", JSON.stringify(projects, null, 2));

        const combinedDescription = projects.map(proj => `${proj.name}: ${proj.description}`).join("; ");

        if (workHourEntry) {
            let existingProjects = [];
            try {
                existingProjects = workHourEntry.projects ? JSON.parse(workHourEntry.projects) : [];
                if (!Array.isArray(existingProjects)) existingProjects = [];
            } catch (error) {
                console.error("Error parsing existing projects:", error);
                existingProjects = [];
            }

            existingProjects.push(...projects);
            const totalHours = existingProjects.reduce((sum, proj) => sum + proj.hours, 0);

            await workHourEntry.update({
                projects: JSON.stringify(existingProjects),
                hours_worked: totalHours,
                description: combinedDescription
            });

            console.log("Updated entry for", username, "Total Hours:", totalHours);
        } else {
            let signaturePath = null;

            if (signatureData) {
                const base64Data = signatureData.replace(/^data:image\/png;base64,/, "");
                const fileName = `${username}_${Date.now()}.png`;
                signaturePath = `signatures/${fileName}`;
                const filePath = path.join(__dirname, signaturePath);
                fs.writeFileSync(filePath, base64Data, 'base64');
            }

          await WorkHour.create({
    employee_id: employee.id,
    date: logDate.toISODate(),
    projects: JSON.stringify(projects), 
    hours_worked: projects.reduce((sum, proj) => sum + proj.hours, 0),
    description: combinedDescription,
    signature: signaturePath
});

            console.log("New work hours entry logged successfully for:", username);
        }

        return res.redirect('/work-hours');
    } catch (error) {
        console.error("Error Logging Work Hours:", error);
        res.status(500).send("Database error: " + error.message);
    }
});

// ======================== Edit Work Hours ========================
app.get('/admin/edit-hours/:id', isAuthenticated, async (req, res) => {
  try {
    const username = req.session.username;
    const role = req.session.role || "user";

    const workHour = await WorkHour.findByPk(req.params.id);
    if (!workHour) return res.redirect('/work-hours');

    const employee = await Employee.findByPk(workHour.employee_id);
    if (!employee) return res.status(404).send("Employee not found");

    if (role !== "admin" && employee.name !== username) {
      return res.status(403).send("You do not have permission to edit this entry.");
    }

let projects = [];

try {
  const raw = workHour.projects;

  if (typeof raw === "string") {
    let parsed = JSON.parse(raw);
    
    // If still a string, parse again
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (Array.isArray(parsed)) {
      projects = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      projects = [parsed];
    }
  } else if (Array.isArray(raw)) {
    projects = raw;
  } else if (typeof raw === "object" && raw !== null) {
    projects = [raw];
  }

} catch (err) {
  console.error("Project parse error:", err);
  projects = [];
}

    console.log("Parsed Projects:", projects);
   return res.render('edit-hours', { 
  workHour, 
  projects, 
  user: { username, role } 
});


  } catch (err) {
    console.error("Edit fetch failed:", err);
    return res.redirect('/work-hours');
  }
}); 


// ======================== Update Work Hours ========================
app.post('/update-hours/:id', isAuthenticated, async (req, res) => {
    try {
        const { date } = req.body;
        const username = req.session.username;
        const role = req.session.role || "user";

        let workHour = await WorkHour.findByPk(req.params.id);

        if (!workHour) return res.redirect(role === 'admin' ? '/admin/all-work-hours' : '/work-hours');
;

        if (role !== "admin" && workHour.employee_id !== username) {
            return res.status(403).send("You do not have permission to update this entry.");
        }

        // Manually reconstruct the nested projects array
const rawProjects = req.body.projects || {};
const updatedProjects = [];

for (const key in rawProjects) {
    if (Object.hasOwn(rawProjects, key)) {
        const project = rawProjects[key];
        if (project && typeof project === 'object' && project.name?.trim()) {
            updatedProjects.push({
                name: project.name.trim(),
                hours: parseFloat(project.hours) || 0,
                location: project.location?.trim() || "",
                description: project.description?.trim() || ""
            });
        }
    }
}

        // If nothing remains, delete the whole entry
        if (updatedProjects.length === 0) {
            await workHour.destroy();
            res.redirect(role === 'admin' ? '/admin/all-work-hours' : '/work-hours');

        }

        const totalHours = updatedProjects.reduce((sum, p) => sum + p.hours, 0);
        const combinedDescription = updatedProjects.map(p => `${p.name}: ${p.description}`).join("; ");

await workHour.update({
  date,
  projects: Array.isArray(updatedProjects) ? JSON.stringify(updatedProjects) : "[]",
  hours_worked: updatedProjects.reduce((sum, p) => sum + p.hours, 0),
  description: updatedProjects.map(p => `${p.name}: ${p.description}`).join("; ")
});

        console.log(`Work hour entry ${req.params.id} updated.`);
        res.redirect(role === 'admin' ? '/admin/all-work-hours' : '/work-hours');

    } catch (error) {
        console.error("Error updating work hours:", error);
        res.redirect(role === 'admin' ? '/admin/all-work-hours' : '/work-hours');
    }
});

// ======================== Delete Work Hours ========================
app.get('/delete-hours/:id', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        const role = req.session.role || "user";

        // ?? Find the entry first
        const workHour = await WorkHour.findByPk(req.params.id);

        if (!workHour) {
            console.error("? Work hour entry not found!");
            return res.redirect('/work-hours');
        }

        // Ensure only the owner or admin can delete
        if (role !== "admin" && workHour.employee_id !== username) {
            console.error("Unauthorized access to delete work hour.");
            return res.status(403).send("You do not have permission to delete this entry.");
        }

        // ? Delete entry
        await WorkHour.destroy({ where: { id: req.params.id } });

        console.log(`Work hours deleted successfully for ID: ${req.params.id}`);
        res.redirect('/work-hours');
    } catch (error) {
        console.error("? Error deleting work hours:", error);
        res.redirect('/work-hours');
    }
});

// --------------------- route (POST) for editing employees info---------------------

app.post('/edit-profile', isAuthenticated, async (req, res) => {

    console.log("Incoming profile data:", req.body);

    const username = req.session.username;

    const {
        full_name,
        dob,
        email,
        pronouns,
        department,
        title,
        tshirt_size,
        emergency_contact_name,
        emergency_contact_phone
    } = req.body;

    await Employee.update({
        full_name,
        dob,
        email,
        pronouns,
        department,
        title,
        tshirt_size,
        emergency_contact_name,
        emergency_contact_phone
    }, {
        where: { name: username }
    });

    res.redirect('/edit-profile');
});

// ---------------------- Employees profile editing ---------------------


app.get('/edit-profile', isAuthenticated, async (req, res) => {
    const username = req.session.username;

    const employee = await Employee.findOne({
        where: { name: username }
    });

    if (!employee) {
        return res.status(404).send("Employee not found");
    }

    res.render('edit-profile', { employee });
});


// ======================== Logout Route ========================
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("? Error logging out:", err);
            return res.send("Error logging out");
        }
        console.log("? User logged out successfully.");
        res.redirect('/login');
    });
});

// Manual trigger endpoint
app.get('/sendhours', isAuthenticated, async (req, res) => {
    try {
        const role = req.session.role;

        if (role !== 'admin') {
            return res.status(403).send("Access denied. Only admins can trigger this.");
        }

        await generateAndSendReport();
        res.send("Weekly report successfully generated and sent!");
    } catch (error) {
        console.error("Error sending the report manually:", error);
        res.status(500).send("Error generating and sending the report.");
    }
});

// ======================== Weekly Report Generation & Email ========================

const transporter = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function generateAndSendReport() {
    console.log("Generating Weekly report...");

    const now = new Date();
    const day = now.getDay();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - day - 6);
    lastMonday.setHours(0, 0, 0, 0);

    const lastFriday = new Date(lastMonday);
    lastFriday.setDate(lastMonday.getDate() + 4);
    lastFriday.setHours(23, 59, 59, 999);

    try {
        const workHours = await WorkHour.findAll({
            where: {
                date: {
                    [Op.gte]: lastMonday,
                    [Op.lte]: lastFriday,
                }
            },
            include: [{
                model: Employee,
                attributes: ["id", "name", "full_name"]
            }],
            attributes: ['id', 'employee_id', 'date', 'projects', 'hours_worked', 'description', 'signature'],
            order: [["employee_id", "ASC"], ["date", "ASC"]],
        });

        if (!workHours.length) {
            console.log("?? No work hours found for this week.");
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: "employee.hodder@gmail.com",
                subject: "Weekly Work Hours Report",
                text: "No work hours were logged this week.",
            });
            return;
        }

        const pad = n => String(n).padStart(2, '0');
        const shortMonth = lastMonday.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = String(lastMonday.getFullYear()).slice(2);
        const filenameLabel = `${pad(lastMonday.getDate())}-${pad(lastFriday.getDate())}${shortMonth}${year}`;
        const filename = `${filenameLabel}.xlsx`;
        const fullPath = path.resolve(__dirname, filename);

        const wb = new ExcelJS.Workbook();
        const columns = [
            { header: "Name", key: "Name", width: 20 },
            { header: "Date", key: "Date", width: 15 },
            { header: "Projects", key: "Projects", width: 40 },
            { header: "Total Hours", key: "TotalHours", width: 15 },
            { header: "Description", key: "Description", width: 30 },
            { header: "Signature", key: "Signature", width: 20 },
        ];

        const summarySheet = wb.addWorksheet("All Employees");
        summarySheet.columns = columns;

        const employeeSheets = {};
        const setHeaderStyle = sheet => {
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF00' }
                };
            });
        };
        setHeaderStyle(summarySheet);

        for (const entry of workHours) {
            const employeeName = entry.Employee?.full_name || entry.Employee?.name || entry.employee_id;
            const dateStr = entry.date.toISOString().split('T')[0];

            let projects = [];
            try {
                let raw = entry.projects;
                if (typeof raw === 'string') raw = JSON.parse(raw);
                projects = Array.isArray(raw) ? raw : [raw];
                projects = projects.map(p => (typeof p === 'string' ? JSON.parse(p) : p)).filter(Boolean);
            } catch (err) {
                console.error(`Failed to parse projects for ${employeeName}`, err);
            }

            const projectDetails = projects.length > 0
                ? projects.map((p, i) => `- ${p.name?.trim() || `Unnamed-${i}`} (${p.hours || 'N/A'} hrs) @ ${p.location || 'Unknown'}`).join("\n")
                : "No projects logged.";

            const rowData = {
                Name: employeeName,
                Date: dateStr,
                Projects: projectDetails,
                TotalHours: entry.hours_worked,
                Description: entry.description || 'N/A',
                Signature: ""
            };

            const summaryRow = summarySheet.addRow(rowData);
            summarySheet.getRow(summaryRow.number).getCell("Projects").alignment = { wrapText: true };
            summarySheet.getRow(summaryRow.number).getCell("Description").alignment = { wrapText: true };

            const sigPath = entry.signature?.startsWith("signatures/")
                ? path.resolve(__dirname, entry.signature)
                : path.resolve(__dirname, "signatures", entry.signature || "");

            try {
                if (fs.existsSync(sigPath) && fs.lstatSync(sigPath).isFile()) {
                    const imageId = wb.addImage({ filename: sigPath, extension: 'png' });
                    summarySheet.addImage(imageId, {
                        tl: { col: 5, row: summaryRow.number - 1 },
                        ext: { width: 80, height: 30 }
                    });
                } else {
                    summarySheet.getRow(summaryRow.number).getCell("Signature").value = "Signed by Admin";
                    summarySheet.getRow(summaryRow.number).getCell("Signature").font = { italic: true };
                }
            } catch (err) {
                summarySheet.getRow(summaryRow.number).getCell("Signature").value = "Signed by Admin";
                summarySheet.getRow(summaryRow.number).getCell("Signature").font = { italic: true };
            }

            const safeSheetName = employeeName.replace(/[/\\?*\[\]]/g, '-');
            if (!employeeSheets[safeSheetName]) {
                const sheet = wb.addWorksheet(safeSheetName);
                sheet.columns = columns;
                setHeaderStyle(sheet);
                employeeSheets[safeSheetName] = sheet;
            }

            const empSheet = employeeSheets[safeSheetName];
            const empRow = empSheet.addRow(rowData);
            empSheet.getRow(empRow.number).getCell("Projects").alignment = { wrapText: true };
            empSheet.getRow(empRow.number).getCell("Description").alignment = { wrapText: true };

            try {
                if (fs.existsSync(sigPath) && fs.lstatSync(sigPath).isFile()) {
                    const imageId = wb.addImage({ filename: sigPath, extension: 'png' });
                    empSheet.addImage(imageId, {
                        tl: { col: 5, row: empRow.number - 1 },
                        ext: { width: 80, height: 30 }
                    });
                } else {
                    empSheet.getRow(empRow.number).getCell("Signature").value = "Signed by Admin";
                    empSheet.getRow(empRow.number).getCell("Signature").font = { italic: true };
                }
            } catch (err) {
                empSheet.getRow(empRow.number).getCell("Signature").value = "Signed by Admin";
                empSheet.getRow(empRow.number).getCell("Signature").font = { italic: true };
            }
        }

        for (const [name, sheet] of Object.entries(employeeSheets)) {
            const values = sheet.getColumn("TotalHours").values.slice(2);
            const total = values.reduce((sum, val) => sum + (typeof val === "number" ? val : 0), 0);
            const totalRow = sheet.addRow({ TotalHours: total });
            totalRow.getCell("TotalHours").font = { bold: true };
            totalRow.getCell("TotalHours").alignment = { horizontal: "right" };
            sheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
            totalRow.getCell("A").value = "TOTAL HOURS:";
            totalRow.getCell("A").font = { bold: true };
        }

        await wb.xlsx.writeFile(fullPath);
        console.log(`Excel report created: ${filename}`);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "employee.hodder@gmail.com",
            subject: `Weekly Work Hours Report: ${filenameLabel}`,
            text: "Weekly report attached.",
            attachments: [{ filename, path: fullPath }],
        });

        console.log(`?? Email sent with attachment: ${filename}`);
        fs.unlinkSync(fullPath);
        console.log("Cleaned up:", filename);

    } catch (err) {
        console.error("Report generation failed:", err);
    }
}

nodeCron.schedule("0 9 * * 1", async () => {
    console.log("Scheduled weekly report triggered (Monday 9 AM)...");
    await generateAndSendReport();
});


// ======================== Generate & Send PDF ========================
async function generateAndSendPDF(formData, templateFile, reportType, res, loggedInUser) {
    let browser;
    let pdfPath;
    const tempFiles = [];

    try {
        if (!formData) {
            throw new Error("Form data is missing.");
        }

        console.log("Form data for EJS template:", formData);

        const htmlContent = await ejs.renderFile(
            path.join(__dirname, "views", templateFile),
            { formData, loggedInUser }
        );

        browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        const reportsDir = path.join(__dirname, "reports");

        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const safeReportType = reportType.replace(/[\/\\]/g, "_");
        pdfPath = path.join(reportsDir, `${safeReportType}-${Date.now()}.pdf`);

        await page.pdf({
            path: pdfPath,
            format: "A4",
            printBackground: true,
        });

        tempFiles.push(pdfPath);
        console.log(`PDF generated successfully: ${pdfPath}`);

        const attachments = [{
            filename: `${safeReportType}.pdf`,
            path: pdfPath,
            contentType: "application/pdf",
        }];

        const imageFields = ["picture1", "picture2", "picture3"];
        for (const field of imageFields) {
            if (formData[field]) {
                try {
                    await fs.promises.access(formData[field]);
                    attachments.push({
                        filename: path.basename(formData[field]),
                        path: formData[field],
                        contentType: "image/jpeg",
                    });
                    console.log(`Added ${field} as attachment: ${formData[field]}`);
                } catch (error) {
                    console.warn(`File ${formData[field]} not found. Skipping attachment.`);
                }
            }
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.REPORT_RECIPIENT || "employee.hodder@gmail.com",
            subject: reportType,
            text: "Attached is the requested service report along with uploaded pictures.",
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.response);

        console.log("Cleaning up temporary files...");
        for (const file of tempFiles) {
            try {
                await fs.promises.unlink(file);
                console.log(`Deleted temporary file: ${file}`);
            } catch (error) {
                console.error(`Error deleting temporary file ${file}:`, error);
            }
        }

        res.send(`${reportType} submitted and emailed successfully!`);
    } catch (error) {
        console.error("Error in generateAndSendPDF:", error);
        res.status(500).send(`Error processing the ${reportType}: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

//Start Server
app.listen(PORT, () => console.log(`?? Server running on http://localhost:${PORT}`))
