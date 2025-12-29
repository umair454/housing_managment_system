const API_URL = "http://localhost:5000";
let editMode = false;
let currentEditId = null;

// 1. Data Load Karne Ka Function (STRICT FILTER + QUICK BILL BUTTON)
async function loadResidents() {
    try {
        const response = await fetch(`${API_URL}/residents`);
        const data = await response.json();
        const tableBody = document.querySelector("#residentTable tbody");
        if (tableBody) {
            tableBody.innerHTML = "";
            
            // 🔥 FILTER: Sirf asli residents dikhao
            const actualResidents = data.filter(res => res.house_no !== 'All');

            actualResidents.forEach(res => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${res.name}</td>
                    <td>${res.house_no}</td>
                    <td>${res.phone_no || '---'}</td>
                    <td>${res.cnic || '---'}</td>
                    <td><span class="status-${res.status.toLowerCase()}">${res.status}</span></td>
                    <td>
                        <button class="edit-btn" style="background: #10b981; border-color: #10b981;" onclick="viewCnic('${res.name}', '${res.cnic_front}', '${res.cnic_back}')">Docs</button>
                        
                        <button class="edit-btn" style="background: #f59e0b; border-color: #f59e0b;" onclick="openQuickBillModal(${res.id}, '${res.name}', ${res.monthly_bill})">Bill</button>
                        
                        <button class="edit-btn" onclick='openEditModal(${JSON.stringify(res)})'>Edit</button>
                        <button class="edit-btn" style="background: #ef4444; border-color: #ef4444;" onclick="deleteResident(${res.id})">Delete</button>
                    </td>
                `;
            });
        }
    } catch (err) { console.error("Error loading data:", err); }
}

// 2. QUICK BILL MODAL LOGIC
function openQuickBillModal(id, name, amount) {
    document.getElementById("quickBillResId").value = id;
    document.getElementById("billForName").innerText = `Generating bill for: ${name}`;
    
    // 🔥 FIX: Database wala individual amount yahan set hoga
    document.getElementById("quickBillAmount").value = amount || 15000;
    
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById("quickBillMonth").value = monthName;
    
    document.getElementById("quickBillModal").style.display = "flex";
}

// Quick Bill Submit Handler
const quickBillForm = document.getElementById("quickBillForm");
if (quickBillForm) {
    quickBillForm.onsubmit = async (e) => {
        e.preventDefault();
        const billData = {
            resident_id: document.getElementById("quickBillResId").value,
            amount: document.getElementById("quickBillAmount").value,
            bill_month: document.getElementById("quickBillMonth").value,
            due_date: document.getElementById("quickBillDate").value
        };

        try {
            const res = await fetch(`${API_URL}/generate-bill`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(billData)
            });

            if(res.ok) {
                alert("✅ Bill Generated & WhatsApp Notification Sent!");
                document.getElementById("quickBillModal").style.display = "none";
                quickBillForm.reset();
            }
        } catch (err) { console.error("Quick Bill Error:", err); }
    };
}

// 3. CNIC Photos Dekhne Ka Function
function viewCnic(name, front, back) {
    document.getElementById("viewResName").innerText = `${name}'s Documents`;
    const frontImg = front ? `${API_URL}/uploads/cnic/${front}` : "https://via.placeholder.com/350x200?text=No+Front+Image";
    const backImg = back ? `${API_URL}/uploads/cnic/${back}` : "https://via.placeholder.com/350x200?text=No+Back+Image";
    
    document.getElementById("frontPreview").src = frontImg;
    document.getElementById("backPreview").src = backImg;
    
    document.getElementById("viewCnicModal").style.display = "flex";
}

// 4. Add Resident Button Logic
function initAddButton() {
    const addBtn = document.getElementById("openModalBtn");
    if (addBtn) {
        addBtn.onclick = () => {
            resetForm(); 
            document.getElementById("residentModal").style.display = "flex";
        };
    }
}

// 5. Edit Modal Kholne Ka Function
function openEditModal(res) {
    editMode = true; 
    currentEditId = res.id;
    
    document.getElementById("resName").value = res.name;
    document.getElementById("resHouse").value = res.house_no;
    document.getElementById("resPhone").value = res.phone_no || "";
    document.getElementById("resCNIC").value = res.cnic || "";
    document.getElementById("resAddress").value = res.address || "";
    document.getElementById("resEmergency").value = res.emergency_contact || "";
    document.getElementById("resStatus").value = res.status;
    
    // 🔥 NEW: Set monthly bill value in edit form
    if(document.getElementById("resMonthlyBill")) {
        document.getElementById("resMonthlyBill").value = res.monthly_bill || 15000;
    }

    document.querySelector("#residentModal h2").innerText = "Edit Resident Profile";
    document.getElementById("residentModal").style.display = "flex";
}

// 6. Form Submit Logic (FIXED SAVE BUTTON)
const resForm = document.getElementById("addResidentForm");
if (resForm) {
    resForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append("name", document.getElementById("resName").value);
        formData.append("house_no", document.getElementById("resHouse").value);
        formData.append("phone_no", document.getElementById("resPhone").value);
        formData.append("cnic", document.getElementById("resCNIC").value);
        formData.append("address", document.getElementById("resAddress").value);
        formData.append("emergency_contact", document.getElementById("resEmergency").value);
        formData.append("status", document.getElementById("resStatus").value);
        
        // 🔥 NEW: Append monthly bill to form data
        if(document.getElementById("resMonthlyBill")) {
            formData.append("monthly_bill", document.getElementById("resMonthlyBill").value);
        }

        const frontFile = document.getElementById("cnicFront");
        const backFile = document.getElementById("cnicBack");

        if (frontFile && frontFile.files[0]) formData.append("cnicFront", frontFile.files[0]);
        if (backFile && backFile.files[0]) formData.append("cnicBack", backFile.files[0]);

        let url = editMode ? `${API_URL}/update-resident/${currentEditId}` : `${API_URL}/add-resident`;
        let method = editMode ? "PUT" : "POST";

        try {
            const res = await fetch(url, { method: method, body: formData });
            if(res.ok) {
                alert(editMode ? "✅ Profile Updated!" : "✅ Resident Added!");
                resetForm();
                loadResidents();
            } else {
                alert("❌ Save failed. Please check server logs.");
            }
        } catch (err) { 
            console.error("Submit error:", err);
            alert("❌ Connection Error!");
        }
    };
}

// 7. Delete Resident Function
async function deleteResident(id) {
    if (confirm("Are you sure?")) {
        try {
            const response = await fetch(`${API_URL}/delete-resident/${id}`, { method: "DELETE" });
            if (response.ok) { loadResidents(); }
        } catch (err) { console.error("Delete error:", err); }
    }
}

function resetForm() {
    editMode = false;
    currentEditId = null;
    const form = document.getElementById("addResidentForm");
    if (form) form.reset();
    document.querySelector("#residentModal h2").innerText = "Resident Registration";
    document.getElementById("residentModal").style.display = "none";
    document.getElementById("viewCnicModal").style.display = "none";
    document.getElementById("quickBillModal").style.display = "none";
}

// Close listeners
window.onclick = (event) => {
    if (event.target.className === 'modal') { resetForm(); }
};

const closeBtns = document.querySelectorAll(".close-btn");
closeBtns.forEach(btn => btn.onclick = resetForm);

window.onload = () => {
    loadResidents();
    initAddButton();
};