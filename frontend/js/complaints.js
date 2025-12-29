const API_URL = "http://localhost:5000";

// 🔥 NAYA: Database se staff ki list mangwane ka function
async function getStaffList() {
    try {
        const res = await fetch(`${API_URL}/all-staff`);
        return await res.json();
    } catch (err) {
        console.error("Staff fetch error:", err);
        return [];
    }
}

// 1. Saare Complaints Load Karne Ka Function (STRICT FILTER)
async function loadComplaints() {
    try {
        // Backend se data aur staff list mangwana
        const [compRes, staffList] = await Promise.all([
            fetch(`${API_URL}/complaints`),
            getStaffList()
        ]);
        
        const data = await compRes.json();
        const tableBody = document.querySelector("#complaintsTable tbody");
        
        if (tableBody) {
            tableBody.innerHTML = ""; 

            const actualComplaints = data.filter(comp => comp.house_no !== 'All' && comp.house_no !== "");

            if (actualComplaints.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding:20px; color:#888;'>No actual complaints found.</td></tr>";
                return;
            }

            actualComplaints.forEach(comp => {
                const row = tableBody.insertRow();

                // Photo Logic
                const photoContent = comp.complaint_photo ? 
                    `<a href="${API_URL}/uploads/complaints/${comp.complaint_photo}" target="_blank" style="color: #3b82f6; text-decoration: none; font-size: 12px; font-weight: 600;">
                        <i class="fa fa-image"></i> View Photo
                    </a>` : 
                    '<span style="color:#666; font-size: 12px;">No Photo</span>';

                // 🔥 DYNAMIC DROPDOWN LOGIC: Staff Management wale staff dikhana
                let staffOptions = `<option value="">Select Staff</option>`;
                staffList.forEach(s => {
                    staffOptions += `<option value="${s.name}" ${comp.assigned_staff === s.name ? 'selected' : ''}>${s.name} (${s.category})</option>`;
                });

                row.innerHTML = `
                    <td>${comp.resident_name || 'Resident'}</td>
                    <td>${comp.house_no}</td>
                    <td>${comp.category}</td>
                    <td title="${comp.description}">${comp.description.substring(0, 30)}${comp.description.length > 30 ? '...' : ''}</td>
                    <td>${photoContent}</td> 
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <select id="staff-select-${comp.id}" style="background: #1e293b; color: white; border: 1px solid #334155; padding: 5px; border-radius: 5px; font-size: 12px;">
                                ${staffOptions}
                            </select>
                            <button class="edit-btn" style="width: auto; padding: 5px 10px; font-size: 11px; background: #3b82f6;" onclick="assignStaff(${comp.id})">
                                <i class="fa fa-user-plus"></i> Assign
                            </button>
                        </div>
                    </td>
                    <td><span class="status-${comp.status.toLowerCase()}">${comp.status}</span></td>
                    <td>
                        ${comp.status === 'Pending' 
                            ? `<button class="edit-btn" style="background: #10b981; border-color: #10b981; cursor:pointer;" onclick="resolveComplaint(${comp.id})"><i class="fa fa-check"></i> Resolve</button>`
                            : `<span style="color: #10b981; font-weight:600;"><i class="fa fa-circle-check"></i> Fixed ✅</span>`}
                    </td>
                `;
            });
        }
    } catch (err) { 
        console.error("❌ Complaints loading error:", err); 
    }
}

// 🔥 Naya Function: Button click par Staff Assign karne ke liye
async function assignStaff(id) {
    const staffName = document.getElementById(`staff-select-${id}`).value;
    
    if (!staffName) {
        alert("Please select a staff member first!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/assign-staff/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_name: staffName })
        });
        
        if (response.ok) {
            alert(`✅ Task successfully assigned to ${staffName}. WhatsApp notification sent!`);
            loadComplaints(); 
        } else {
            alert("❌ Failed to assign staff.");
        }
    } catch (err) {
        console.error("❌ Staff update error:", err);
        alert("❌ Server Error!");
    }
}

// 2. Complaint ko Resolve karne ka function
async function resolveComplaint(id) {
    if(!confirm("Mark this complaint as resolved?")) return;
    
    try {
        const response = await fetch(`${API_URL}/update-complaint-status/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: 'Resolved' })
        });

        if (response.ok) {
            alert("✅ Complaint Resolved!");
            loadComplaints(); 
        }
    } catch (err) {
        console.error("❌ Update error:", err);
    }
}

// Page load hotay hi data fetch karein
window.onload = loadComplaints;