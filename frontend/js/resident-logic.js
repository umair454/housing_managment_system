const API_URL = "http://localhost:5000";

// Check Login Session
const userData = JSON.parse(localStorage.getItem("residentUser"));

if (!userData) {
    window.location.href = "resident-login.html";
}

// Sidebar aur Header Update
if (document.getElementById("welcomeText")) {
    document.getElementById("welcomeText").innerText = `Welcome, ${userData.name}`;
}
if (document.getElementById("userHouse")) {
    document.getElementById("userHouse").innerText = `House No: ${userData.house_no}`;
}

// Global chart variables
let billsChart, complaintsChart;

// --- 1. Logout Function ---
function logoutUser() {
    localStorage.removeItem("residentUser");
    window.location.href = "resident-login.html";
}

// --- 2. Load User Dashboard (Personal Complaints Filtered) ---
async function loadUserDashboard() {
    try {
        const [billRes, compRes] = await Promise.all([
            fetch(`${API_URL}/my-bills/${userData.id}`),
            fetch(`${API_URL}/my-complaints/${userData.house_no}`)
        ]);

        const bills = await billRes.json();
        const allData = await compRes.json();

        // 🔥 STRICT FILTER: Sirf personal complaints (Exclude Admin Broadcasts 'All')
        const personalComplaints = allData.filter(c => c.house_no !== 'All');

        // Stats Calculation
        let pendingSum = 0;
        bills.forEach(b => { if(b.payment_status === 'Unpaid') pendingSum += Number(b.amount); });
        
        if (document.getElementById("pendingAmount")) {
            document.getElementById("pendingAmount").innerText = `Rs. ${pendingSum.toLocaleString()}`;
        }
        if (document.getElementById("totalBillsCount")) {
            document.getElementById("totalBillsCount").innerText = bills.length;
        }
        if (document.getElementById("myComplaintsCount")) {
            // Stats mein sirf real complaints ka number dikhayein
            document.getElementById("myComplaintsCount").innerText = personalComplaints.length;
        }

        // --- Complaint Table Rendering (Strict Filter) ---
        const compTableBody = document.querySelector("#userComplaintsTable tbody") || document.querySelector("#complaintsTable tbody");
        if (compTableBody) {
            compTableBody.innerHTML = ""; // 🔥 Clear table before rendering
            if (personalComplaints.length === 0) {
                compTableBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No personal complaints found.</td></tr>";
            } else {
                personalComplaints.forEach(comp => {
                    const row = compTableBody.insertRow();
                    row.innerHTML = `
                        <td>${comp.category}</td>
                        <td>${comp.description}</td>
                        <td>${new Date(comp.created_at).toLocaleDateString()}</td>
                        <td><span class="status-${comp.status.toLowerCase()}">${comp.status}</span> ${comp.assigned_staff ? `<br><small style="color:#3b82f6">Staff: ${comp.assigned_staff}</small>` : ''}</td>
                    `;
                });
            }
        }

        // Bills Table Rendering
        const tableBody = document.querySelector("#userBillsTable tbody");
        if (tableBody) {
            tableBody.innerHTML = ""; // 🔥 Clear table before rendering
            if (bills.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No history found.</td></tr>";
            } else {
                bills.forEach(bill => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${bill.bill_month}</td>
                        <td>Rs. ${Number(bill.amount).toLocaleString()}</td>
                        <td>${new Date(bill.due_date).toLocaleDateString()}</td>
                        <td><span class="status-${bill.payment_status.toLowerCase()}">${bill.payment_status}</span></td>
                        <td><button class="edit-btn" onclick='printUserBill(${JSON.stringify(bill)})'>View</button></td>
                    `;
                });
            }
        }

        initUserCharts(bills, personalComplaints);

    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

// --- 3. Graphs Initialization ---
function initUserCharts(bills, personalComplaints) {
    const billCanvas = document.getElementById('userBillsChart');
    const compCanvas = document.getElementById('userCompChart');
    if (!billCanvas || !compCanvas) return; 

    const billCtx = billCanvas.getContext('2d');
    const compCtx = compCanvas.getContext('2d');

    const paid = bills.filter(b => b.payment_status === 'Paid').length;
    const unpaid = bills.filter(b => b.payment_status === 'Unpaid').length;
    
    // Graphs mein notifications filter ho gayin
    const pending = personalComplaints.filter(c => c.status === 'Pending').length;
    const resolved = personalComplaints.filter(c => c.status === 'Resolved').length;

    if (billsChart) billsChart.destroy();
    billsChart = new Chart(billCtx, {
        type: 'doughnut',
        data: {
            labels: ['Paid', 'Unpaid'],
            datasets: [{
                data: [paid, unpaid],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    if (complaintsChart) complaintsChart.destroy();
    complaintsChart = new Chart(compCtx, {
        type: 'bar',
        data: {
            labels: ['Pending', 'Resolved'],
            datasets: [{
                label: 'Complaints',
                data: [pending, resolved],
                backgroundColor: ['#f59e0b', '#3b82f6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- 4. Notifications Load (ONLY SHOW 'ALL' BROADCASTS) ---
async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/my-complaints/${userData.house_no}`);
        const data = await res.json();
        
        const container = document.getElementById("notificationsContainer");
        const badge = document.getElementById("notifBadge");
        
        // 🔥 STRICT FILTER: Sirf wo dikhao jo Admin ne 'All' bheje hain
        const announcements = data.filter(item => item.house_no === 'All');

        if (badge) {
            badge.innerText = announcements.length;
            badge.style.display = announcements.length > 0 ? "inline-block" : "none";
        }

        if (!container) return;

        container.innerHTML = ""; // 🔥 Container saaf karein
        if (announcements.length === 0) {
            container.innerHTML = '<p style="color: #888; padding: 20px;">No new announcements from Admin.</p>';
            return;
        }

        announcements.forEach(notif => {
            const card = document.createElement("div");
            card.className = "glass-card";
            card.style.cssText = "padding:15px; border-left:5px solid #f59e0b; margin-bottom:10px; background:rgba(255,255,255,0.05); cursor:pointer;";
            
            card.onclick = () => {
                document.getElementById("modalNotifTitle").innerText = notif.category; 
                document.getElementById("modalNotifMsg").innerText = notif.description; 
                document.getElementById("modalNotifDate").innerText = "Posted on: " + new Date(notif.created_at).toLocaleString();
                document.getElementById("notifOpenModal").style.display = "flex";
            };
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <h3 style="color: #f59e0b; margin: 0; font-size: 15px;">📢 ${notif.category}</h3>
                    <small style="color: #666;">${new Date(notif.created_at).toLocaleDateString()}</small>
                </div>
                <p style="margin-top: 8px; color: #ccc; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${notif.description}</p>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("❌ Notification Load Error:", err);
    }
}

// --- 🔥 5. UPDATED: Submit Complaint Logic with Photo Support ---
const complaintForm = document.getElementById("complaintForm") || document.getElementById("addComplaintForm");
if (complaintForm) {
    complaintForm.onsubmit = async (e) => {
        e.preventDefault();
        
        // Multi-part form data use kar rahe hain image upload ke liye
        const formData = new FormData();
        formData.append('resident_name', userData.name);
        formData.append('house_no', userData.house_no);
        formData.append('category', document.getElementById("compCategory").value);
        formData.append('description', document.getElementById("compDesc").value);
        
        const photoInput = document.getElementById("compPhoto"); // HTML mein ye ID honi chahiye
        if (photoInput && photoInput.files[0]) {
            formData.append('photo', photoInput.files[0]);
        }

        try {
            const response = await fetch(`${API_URL}/add-complaint-with-photo`, {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                alert("Complaint registered successfully!");
                complaintForm.reset();
                loadUserDashboard(); 
            }
        } catch (err) {
            console.error("Submission error:", err);
        }
    };
}

// --- 6. Bill Print ---
function printUserBill(bill) {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`<html><head><title>Bill</title></head><body><div style="border:2px solid #2563eb; padding:20px; font-family:sans-serif;"><h2>HMS HUB Bill</h2><p><b>Name:</b> ${userData.name}</p><p><b>Month:</b> ${bill.bill_month}</p><p><b>Amount:</b> Rs. ${bill.amount}</p><p><b>Status:</b> ${bill.payment_status}</p><button onclick="window.print()">Print</button></div></body></html>`);
    printWindow.document.close();
}

// --- 7. Visitor Notification Logic ---
let lastVCount = 0;
async function checkVisitors() {
    try {
        const res = await fetch(`${API_URL}/visitors-log`);
        const allVisitors = await res.json();
        const myVisitors = allVisitors.filter(v => v.house_no === userData.house_no);
        
        const tableBody = document.getElementById("userVisitorsBody");
        const visitorBadge = document.getElementById("visitorBadge");
        const headerDot = document.getElementById("headerNotifDot");

        if (tableBody) {
            tableBody.innerHTML = "";
            if (myVisitors.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No visitors recorded yet.</td></tr>";
            } else {
                myVisitors.forEach(v => {
                    const time = new Date(v.entry_time).toLocaleString('en-PK', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short'});
                    tableBody.innerHTML += `<tr><td><b>${v.visitor_name}</b></td><td>${v.purpose}</td><td>${time}</td><td><span style="color:#10b981"><i class="fa fa-check-circle"></i> Entered</span></td></tr>`;
                });
            }
        }

        if (myVisitors.length > lastVCount && lastVCount !== 0) {
            const diff = myVisitors.length - lastVCount;
            if (visitorBadge) { visitorBadge.innerText = diff; visitorBadge.style.display = "inline-block"; }
            if (headerDot) headerDot.style.display = "block";
        }
        lastVCount = myVisitors.length;
    } catch (err) { console.error("Visitor fetch error:", err); }
}

// Initial Load
window.onload = () => {
    loadUserDashboard();
    loadNotifications();
    checkVisitors();
    setInterval(checkVisitors, 10000); // Har 10 sec baad check karega
};