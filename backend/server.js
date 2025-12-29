const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer'); 
const path = require('path');   
const fs = require('fs');       
const axios = require('axios'); 
const { Client, LocalAuth } = require('whatsapp-web.js'); 
const qrcode = require('qrcode-terminal');             
const cron = require('node-cron');                     

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- OTP Store (Temporary memory for verification) ---
let otpStore = {}; 

// --- WhatsApp Setup ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

let isWhatsAppReady = false; 

client.on('qr', (qr) => {
    console.log('⚠️ SCAN THIS QR CODE FOR WHATSAPP ⚠️');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isWhatsAppReady = true;
    console.log('✅ WhatsApp is Ready and Connected!');
});

client.initialize().catch(err => console.log("WhatsApp Init Error:", err));

async function sendWhatsApp(toPhone, message) {
    if (!isWhatsAppReady) {
        console.log("❌ WhatsApp not ready. Message skipped.");
        return;
    }
    try {
        const cleanPhone = toPhone.startsWith('0') ? '92' + toPhone.slice(1) : toPhone;
        const chatId = cleanPhone + "@c.us";
        await client.sendMessage(chatId, message);
        console.log("✅ WhatsApp Sent to:", cleanPhone);
    } catch (error) {
        console.log("❌ WhatsApp Error:", error.message);
    }
}

// --- Static Folders & Multer ---
app.use('/uploads', express.static('uploads'));

const cnicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/cnic/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: cnicStorage });

const complaintStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/complaints/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'COMP-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadComplaint = multer({ storage: complaintStorage });

// --- MySQL Connection ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Umair@86247', 
    database: 'hms_db',
    port: 3306
});

db.connect(err => {
    if (err) { console.error('❌ Connection Failed!', err.message); return; }
    console.log('✅ Connected to Workbench Database!');
    
    // Disable Safe Updates for the current session to allow password updates
    db.query("SET SQL_SAFE_UPDATES = 0", (safeErr) => {
        if (safeErr) console.error("⚠️ Could not disable safe updates:", safeErr.message);
        else console.log("🛡️ Safe Updates Disabled for Session.");
    });
});

// --- AUTOMATIC MONTHLY BILLING (CRON) ---
cron.schedule('0 0 1 * *', () => {
    generateAutoBills();
});

function generateAutoBills(callback) {
    console.log("🕒 Starting Customized Billing Process...");
    const getResidentsSql = "SELECT id, name, phone_no, monthly_bill FROM residents WHERE status = 'Unpaid'";
    db.query(getResidentsSql, (err, residents) => {
        if (err) {
            console.error("❌ Error fetching residents:", err);
            if(callback) callback(err);
            return;
        }
        if (residents.length === 0) {
            console.log("ℹ️ No residents found with 'Unpaid' status.");
            if(callback) callback(null, "No unpaid residents found.");
            return;
        }

        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        const dueDate = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().split('T')[0];

        let processedCount = 0;
        residents.forEach(res => {
            const currentAmount = res.monthly_bill || 15000; 
            const billSql = "INSERT INTO bills (resident_id, amount, bill_month, due_date, payment_status) VALUES (?, ?, ?, ?, 'Unpaid')";
            db.query(billSql, [res.id, currentAmount, monthName, dueDate], (billErr) => {
                processedCount++;
                if (!billErr) {
                    const msg = `🔔 *Monthly Bill Alert*\n\nDear *${res.name}*,\nYour maintenance bill for *${monthName}* has been generated.\n\n*Amount:* Rs. ${currentAmount}\n*Due Date:* ${dueDate}`;
                    sendWhatsApp(res.phone_no, msg);
                }
                if (processedCount === residents.length && callback) {
                    callback(null, `Billing completed for ${residents.length} unpaid residents.`);
                }
            });
        });
    });
}

app.post('/test-auto-billing', (req, res) => {
    generateAutoBills((err, message) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: message });
    });
});

// --- 🔥 MULTI-ADMIN AUTHENTICATION ---

app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT id, username, role FROM admins WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            res.json({ success: true, user: result[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid Admin Credentials" });
        }
    });
});

app.post('/add-admin', (req, res) => {
    const { username, password, role } = req.body;
    const sql = "INSERT INTO admins (username, password, role) VALUES (?, ?, ?)";
    db.query(sql, [username, password, role], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Admin account created for ${role}!` });
    });
});

app.get('/all-admins', (req, res) => {
    const sql = "SELECT id, username, role, created_at FROM admins ORDER BY id DESC";
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: "Internal Server Error" });
        res.status(200).json(data);
    });
});

app.delete('/delete-admin/:id', (req, res) => {
    db.query("DELETE FROM admins WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Admin removed successfully!" });
    });
});

// --- SECURITY: VISITOR MANAGEMENT ROUTES ---
app.post('/add-visitor', (req, res) => {
    const { visitor_name, phone_no, house_no, purpose } = req.body;
    const sql = "INSERT INTO visitors (visitor_name, phone_no, house_no, purpose) VALUES (?, ?, ?, ?)";
    db.query(sql, [visitor_name, phone_no, house_no, purpose], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.query("SELECT phone_no, name FROM residents WHERE house_no = ?", [house_no], (resErr, residents) => {
            if (!resErr && residents.length > 0) {
                const resPhone = residents[0].phone_no;
                const resName = residents[0].name;
                const alertMsg = `🚪 *Visitor Alert*\n\nDear *${resName}*,\nA visitor is at the main gate for your house.\n\n*Visitor Name:* ${visitor_name}\n*Purpose:* ${purpose}\n\nPlease inform the gate if you do not allow this entry.`;
                sendWhatsApp(resPhone, alertMsg);
            }
        });
        res.json({ success: true, message: "Visitor Entry Logged & Resident Notified!" });
    });
});

app.post('/visitor-exit/:id', (req, res) => {
    const visitorId = req.params.id;
    const exitTime = new Date();
    const query = "UPDATE visitors SET exit_time = ? WHERE id = ?";
    db.query(query, [exitTime, visitorId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: "Exit time recorded" });
    });
});

app.get('/visitors-log', (req, res) => {
    db.query("SELECT * FROM visitors ORDER BY entry_time DESC", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// --- ADMIN: RESIDENTS ROUTES ---
app.get('/residents', (req, res) => {
    const sql = "SELECT * FROM residents ORDER BY id DESC";
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        return res.json(data);
    });
});

app.post('/add-resident', upload.fields([{ name: 'cnicFront' }, { name: 'cnicBack' }]), (req, res) => {
    try {
        const { name, house_no, status, phone_no, cnic, address, emergency_contact, monthly_bill } = req.body;
        const frontImg = req.files && req.files['cnicFront'] ? req.files['cnicFront'][0].filename : null;
        const backImg = req.files && req.files['cnicBack'] ? req.files['cnicBack'][0].filename : null;
        const sql = "INSERT INTO residents (name, house_no, status, phone_no, cnic, address, emergency_contact, cnic_front, cnic_back, monthly_bill) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [name, house_no, status || 'Unpaid', phone_no || '', cnic || '', address || '', emergency_contact || '', frontImg, backImg, monthly_bill || 15000], (err) => {
            if (err) return res.status(500).json({ message: "Database Error" });
            return res.json({ message: "Resident Added Successfully!" });
        });
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

app.put('/update-resident/:id', upload.fields([{ name: 'cnicFront' }, { name: 'cnicBack' }]), (req, res) => {
    const { name, house_no, status, phone_no, cnic, address, emergency_contact, monthly_bill } = req.body;
    const sql = "UPDATE residents SET name=?, house_no=?, status=?, phone_no=?, cnic=?, address=?, emergency_contact=?, monthly_bill=? WHERE id=?";
    db.query(sql, [name, house_no, status, phone_no, cnic, address, emergency_contact, monthly_bill, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Resident Updated Successfully!" });
    });
});

app.delete('/delete-resident/:id', (req, res) => {
    db.query("DELETE FROM residents WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Resident Deleted!" });
    });
});

// --- ADMIN: BILLING ROUTES ---
app.post('/generate-bill', (req, res) => {
    const { resident_id, amount, bill_month, due_date } = req.body;
    db.query("SELECT name, phone_no FROM residents WHERE id = ?", [resident_id], (err, resData) => {
        if (err || resData.length === 0) return res.status(500).json({error: "Resident not found"});
        const sql = "INSERT INTO bills (resident_id, amount, bill_month, due_date) VALUES (?, ?, ?, ?)";
        db.query(sql, [resident_id, amount, bill_month, due_date], (err) => {
            if (err) return res.status(500).json(err);
            sendWhatsApp(resData[0].phone_no, `🔔 *New Bill*\nAmount: Rs. ${amount}\nDue: ${due_date}`);
            return res.json({ message: "Bill Generated!" });
        });
    });
});

app.get('/all-bills', (req, res) => {
    const sql = "SELECT bills.*, residents.name, residents.house_no FROM bills JOIN residents ON bills.resident_id = residents.id ORDER BY bills.created_at DESC";
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        return res.json(data);
    });
});

app.put('/update-bill-status/:id', (req, res) => {
    db.query("UPDATE bills SET payment_status = ? WHERE bill_id = ?", [req.body.status, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Status Updated!" });
    });
});

// --- ADMIN: DASHBOARD STATS ---
app.get('/dashboard-stats', (req, res) => {
    db.query("SELECT COUNT(*) AS total FROM residents", (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json(result[0]);
    });
});

app.get('/pending-bills-sum', (req, res) => {
    db.query("SELECT SUM(amount) AS total_pending FROM bills WHERE payment_status = 'Unpaid'", (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json({ total_pending: result[0].total_pending || 0 });
    });
});

app.get('/complaints-count', (req, res) => {
    db.query("SELECT COUNT(*) AS total FROM complaints WHERE status = 'Pending' AND house_no != 'All'", (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json(result[0]);
    });
});

// --- UPGRADED ADMIN: COMPLAINTS & STAFF ASSIGNMENT ---

app.post('/add-complaint-with-photo', uploadComplaint.single('photo'), (req, res) => {
    const { resident_name, house_no, category, description } = req.body;
    const photo = req.file ? req.file.filename : null;
    const sql = "INSERT INTO complaints (resident_name, house_no, category, description, status, complaint_photo) VALUES (?, ?, ?, ?, 'Pending', ?)";
    db.query(sql, [resident_name, house_no, category, description, photo], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ message: "Complaint filed successfully with photo!" });
    });
});

app.put('/assign-staff/:id', (req, res) => {
    const { staff_name } = req.body;
    db.query("SELECT phone_no FROM staff WHERE name = ?", [staff_name], (err, staffData) => {
        if (!err && staffData.length > 0) {
            const msg = `🛠️ *New Task Assigned*\n\nHello *${staff_name}*,\nYou have been assigned a new maintenance task. Please login to your portal to check details.`;
            sendWhatsApp(staffData[0].phone_no, msg);
        }
    });
    const sql = "UPDATE complaints SET assigned_staff = ? WHERE id = ?";
    db.query(sql, [staff_name, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Staff Assigned Successfully & Notified!" });
    });
});

app.get('/complaints', (req, res) => {
    db.query("SELECT * FROM complaints WHERE house_no != 'All' ORDER BY id DESC", (err, data) => {
        if (err) return res.status(500).json(err);
        return res.json(data);
    });
});

app.put('/update-complaint-status/:id', (req, res) => {
    db.query("UPDATE complaints SET status = ? WHERE id = ?", [req.body.status, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        return res.json({ message: "Updated!" });
    });
});

// --- 🔥 STAFF MANAGEMENT ROUTES (ADMIN SIDE) ---

app.get('/all-staff', (req, res) => {
    db.query("SELECT * FROM staff ORDER BY id DESC", (err, data) => {
        if (err) {
            console.error("❌ Fetch Staff Error:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(200).json(data);
    });
});

app.post('/add-staff', (req, res) => {
    const { name, phone_no, category, password } = req.body;
    if (!name || !phone_no || !category || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const sql = "INSERT INTO staff (name, phone_no, category, password) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, phone_no, category, password], (err, result) => {
        if (err) {
            console.error("❌ Add Staff Error:", err);
            return res.status(500).json({ error: "Database Error: " + err.message });
        }
        res.status(200).json({ success: true, message: "Staff Added Successfully!", id: result.insertId });
    });
});

app.delete('/delete-staff/:id', (req, res) => {
    db.query("DELETE FROM staff WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error("❌ Delete Staff Error:", err);
            return res.status(500).json({ error: "Could not delete staff" });
        }
        res.status(200).json({ success: true, message: "Staff Removed!" });
    });
});

// --- 🔥 STAFF PORTAL ROUTES ---

app.post('/staff-login', (req, res) => {
    const { phone_no, password } = req.body;
    db.query("SELECT * FROM staff WHERE phone_no = ? AND password = ?", [phone_no, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) res.json({ success: true, staff: result[0] });
        else res.status(401).json({ success: false, message: "Invalid Credentials" });
    });
});

app.get('/staff-tasks/:staff_name', (req, res) => {
    const sql = "SELECT * FROM complaints WHERE assigned_staff = ? AND status != 'Resolved' ORDER BY created_at DESC";
    db.query(sql, [req.params.staff_name], (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.put('/complete-task/:id', uploadComplaint.single('completion_photo'), (req, res) => {
    const photo = req.file ? req.file.filename : null;
    const sql = "UPDATE complaints SET status = 'Resolved', completion_photo = ? WHERE id = ?";
    db.query(sql, [photo, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Task marked as completed with proof!" });
    });
});

// --- ADMIN GRAPH STATS ---
app.get('/graph-stats', (req, res) => {
    const sql = `SELECT 
            (SELECT COUNT(*) FROM bills WHERE payment_status = 'Paid') as paidBills,
            (SELECT COUNT(*) FROM bills WHERE payment_status = 'Unpaid') as unpaidBills,
            (SELECT COUNT(*) FROM complaints WHERE status = 'Pending' AND house_no != 'All') as pendingComp,
            (SELECT COUNT(*) FROM complaints WHERE status = 'Resolved' AND house_no != 'All') as resolvedComp`;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        return res.json(result[0]);
    });
});

// --- 🔥 NEW: EXPENSE MANAGEMENT ROUTES ---

app.post('/add-expense', (req, res) => {
    const { title, category, amount, expense_date, description } = req.body;
    const sql = "INSERT INTO expenses (title, category, amount, expense_date, description) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [title, category, amount, expense_date, description], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Expense recorded successfully!" });
    });
});

app.get('/all-expenses', (req, res) => {
    db.query("SELECT * FROM expenses ORDER BY expense_date DESC", (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.delete('/delete-expense/:id', (req, res) => {
    db.query("DELETE FROM expenses WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Expense deleted!" });
    });
});

// Financial summary for Dashboard (Profit/Loss)
app.get('/financial-summary', (req, res) => {
    const sql = `
        SELECT 
            (SELECT SUM(amount) FROM bills WHERE payment_status = 'Paid') as total_income,
            (SELECT SUM(amount) FROM expenses) as total_expense
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        const income = parseFloat(result[0].total_income || 0);
        const expense = parseFloat(result[0].total_expense || 0);
        res.json({ income, expense, balance: (income - expense) });
    });
});

// --- RESIDENT ROUTES ---

// 1. Send OTP
app.post('/send-registration-otp', (req, res) => {
    const house_no = req.body.house_no ? req.body.house_no.trim() : "";
    const phone_no = req.body.phone_no ? req.body.phone_no.trim() : "";
    
    // Exact match using LOWER for robustness
    const sql = "SELECT * FROM residents WHERE LOWER(house_no) = LOWER(?) AND phone_no = ?";
    db.query(sql, [house_no, phone_no], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (result.length > 0) {
            const otp = Math.floor(100000 + Math.random() * 900000);
            otpStore[phone_no] = otp; 
            const msg = `🔐 *HMS Account Setup*\n\nYour code is: *${otp}*\n\nPlease enter this to set your password.`;
            sendWhatsApp(phone_no, msg);
            res.json({ success: true, message: "OTP sent to WhatsApp!" });
        } else {
            res.status(404).json({ success: false, message: "Details match nahi huin record se." });
        }
    });
});

// 2. Verify & Register
app.post('/verify-and-register', (req, res) => {
    const house_no = req.body.house_no ? req.body.house_no.trim() : "";
    const phone_no = req.body.phone_no ? req.body.phone_no.trim() : "";
    const otp = req.body.otp;
    const password = req.body.password ? req.body.password.trim() : "";

    if (otpStore[phone_no] && otpStore[phone_no] == otp) {
        // Safe updates already disabled in connection init
        const sql = "UPDATE residents SET password = ? WHERE LOWER(house_no) = LOWER(?) AND phone_no = ?";
        db.query(sql, [password, house_no, phone_no], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Database update failed. Check House/Phone again." });
            }

            delete otpStore[phone_no]; 
            res.json({ success: true, message: "Password updated successfully!" });
        });
    } else {
        res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }
});

app.post('/resident-login', (req, res) => {
    const h = req.body.house_no ? req.body.house_no.trim() : "";
    const p = req.body.password ? req.body.password.trim() : "";
    
    // Case-insensitive house number check
    const sql = "SELECT * FROM residents WHERE LOWER(house_no) = LOWER(?) AND password = ?";
    db.query(sql, [h, p], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) res.json({ success: true, user: result[0] });
        else res.status(401).json({ success: false, message: "Invalid House No or Password" });
    });
});

app.get('/my-bills/:resident_id', (req, res) => {
    db.query("SELECT * FROM bills WHERE resident_id = ? ORDER BY created_at DESC", [req.params.resident_id], (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

app.get('/my-complaints/:house_no', (req, res) => {
    const house_no = req.params.house_no;
    const sql = "SELECT * FROM complaints WHERE house_no = ? OR house_no = 'All' ORDER BY created_at DESC";
    db.query(sql, [house_no], (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// --- SERVER START ---
app.listen(5000, () => {
    console.log("🚀 Server running on http://localhost:5000");
});