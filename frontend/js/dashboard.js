const API_URL = "http://localhost:5000";

// --- Security Check & Logout ---
if (localStorage.getItem("adminUser") === null) {
    window.location.href = "login.html";
}
function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

// --- Display Current Date ---
function displayDate() {
    const dateElement = document.getElementById("current-date");
    if (dateElement) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.innerText = now.toLocaleDateString('en-US', options);
    }
}

// --- 1. Charts Initialization ---
let revenueChart, complaintChart;

function initCharts(paidCount, unpaidCount, pendingComp, resolvedComp) {
    const canvas1 = document.getElementById('revenueChart');
    const canvas2 = document.getElementById('complaintChart');

    if (!canvas1 || !canvas2) return; 

    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');

    if (revenueChart) revenueChart.destroy();
    if (complaintChart) complaintChart.destroy();

    revenueChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Paid Bills', 'Unpaid Bills'],
            datasets: [{
                data: [paidCount, unpaidCount],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Revenue Overview', color: '#fff' } } 
        }
    });

    complaintChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Pending', 'Resolved'],
            datasets: [{
                label: 'Complaints',
                data: [pendingComp, resolvedComp],
                backgroundColor: ['#f59e0b', '#3b82f6']
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#fff' } }, 
                x: { ticks: { color: '#fff' } } 
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- 2. Stats & Charts Data Fetching ---
async function updateStats() {
    try {
        const resResponse = await fetch(`${API_URL}/dashboard-stats`);
        const resData = await resResponse.json();
        const resValue = document.querySelector("#card-residents .value");
        if(resValue) resValue.innerText = resData.total || 0;
        
        const billResponse = await fetch(`${API_URL}/pending-bills-sum`);
        const billData = await billResponse.json();
        const billValue = document.querySelector("#card-billing .value");
        if(billValue) billValue.innerText = `Rs. ${Number(billData.total_pending || 0).toLocaleString()}`;

        const finRes = await fetch(`${API_URL}/financial-summary`);
        const finData = await finRes.json();
        const balElement = document.getElementById("net-balance");
        const balStatus = document.getElementById("balance-status");
        if (balElement) {
            balElement.innerText = `Rs. ${Number(finData.balance || 0).toLocaleString()}`;
            if (balStatus) {
                balStatus.innerText = finData.balance >= 0 ? "In Profit" : "In Loss";
                balStatus.style.color = finData.balance >= 0 ? "#10b981" : "#ef4444";
            }
        }

        const compResponse = await fetch(`${API_URL}/complaints-count`);
        const compData = await compResponse.json();
        const compValue = document.querySelector("#card-complaints .value");
        if (compValue) compValue.innerText = compData.total || 0;

        const visRes = await fetch(`${API_URL}/visitors-log`);
        const visData = await visRes.json();
        const visElement = document.getElementById("today-visitors");
        if (visElement) {
            const today = new Date().toISOString().split('T')[0];
            const todayCount = visData.filter(v => v.entry_time && v.entry_time.startsWith(today)).length;
            visElement.innerText = todayCount;
        }

        const graphRes = await fetch(`${API_URL}/graph-stats`);
        const graphData = await graphRes.json();

        initCharts(
            graphData.paidBills || 0, 
            graphData.unpaidBills || 0, 
            graphData.pendingComp || 0, 
            graphData.resolvedComp || 0
        );

    } catch (err) { console.error("❌ Stats update error:", err); }
}

// --- 3. Detailed Resident Registration ---
async function loadResidents() {
    try {
        const response = await fetch(`${API_URL}/residents`);
        const data = await response.json();
        const tableBody = document.querySelector("#residentTable tbody");

        if (tableBody) {
            tableBody.innerHTML = ""; 
            data.slice(0, 5).forEach(res => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${res.name}</td>
                    <td>${res.house_no}</td>
                    <td><span class="status-active">Active</span></td>
                    <td>
                        <button class="edit-btn" style="background: #10b981; border-color: #10b981; color: white; cursor: pointer;" onclick="openBillModal(${res.id}, '${res.name}')">Bill</button>
                    </td>
                `;
            });
        }
    } catch (err) { console.log("Waiting for server..."); }
}

// --- 4. EXCEL REPORT GENERATION (NEW) ---
async function downloadExcelReport(type) {
    try {
        let endpoint = type === 'visitors' ? '/visitors-log' : '/all-bills';
        const res = await fetch(`${API_URL}${endpoint}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            alert("Export karne ke liye koi data nahi mila!");
            return;
        }

        let cleanedData;
        if (type === 'visitors') {
            cleanedData = data.map(v => ({
                "Visitor Name": v.visitor_name,
                "Phone": v.phone_no,
                "House No": v.house_no,
                "Purpose": v.purpose,
                "Entry Time": new Date(v.entry_time).toLocaleString(),
                "Exit Time": v.exit_time ? new Date(v.exit_time).toLocaleString() : "Inside"
            }));
        } else {
            cleanedData = data.map(b => ({
                "Resident": b.name,
                "House No": b.house_no,
                "Amount": b.amount,
                "Month": b.bill_month,
                "Status": b.payment_status,
                "Due Date": b.due_date
            }));
        }

        const worksheet = XLSX.utils.json_to_sheet(cleanedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${type}_report_${Date.now()}.xlsx`);
    } catch (err) {
        alert("Report download mein masla aaya!");
        console.error(err);
    }
}

// --- 5. AUTO-BILLING TRIGGER (NEW) ---
async function runAutoBilling(btn) {
    if (!confirm("Kya aap sabhi residents ke liye bills generate karna chahte hain?")) return;
    
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/test-auto-billing`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            alert("✅ " + data.message);
            updateStats();
        } else {
            alert("❌ Error: " + data.error);
        }
    } catch (err) {
        alert("❌ Connection failed!");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    displayDate();
    loadResidents();
    updateStats();
    setInterval(updateStats, 30000);

    const addForm = document.getElementById("addResidentForm");
    if (addForm) {
        addForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('name', document.getElementById("resName").value);
            formData.append('house_no', document.getElementById("resHouse").value);
            formData.append('phone_no', document.getElementById("resPhone").value);
            formData.append('cnic', document.getElementById("resCNIC").value);
            formData.append('address', document.getElementById("resAddress").value);
            formData.append('emergency_contact', document.getElementById("resEmergency").value);
            formData.append('status', document.getElementById("resStatus").value);

            const frontFile = document.getElementById("cnicFront").files[0];
            const backFile = document.getElementById("cnicBack").files[0];
            if (frontFile) formData.append('cnicFront', frontFile);
            if (backFile) formData.append('cnicBack', backFile);

            try {
                const response = await fetch(`${API_URL}/add-resident`, { method: "POST", body: formData });
                if (response.ok) { alert("✅ Resident Added!"); location.reload(); }
            } catch (err) { alert("❌ Submission failed!"); }
        };
    }
});