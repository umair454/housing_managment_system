const API_URL = "http://localhost:5000";
const userData = JSON.parse(localStorage.getItem("residentUser"));

if (!userData) window.location.href = "resident-login.html";

// 1. Load User's History
async function loadMyComplaints() {
    try {
        const res = await fetch(`${API_URL}/my-complaints/${userData.house_no}`);
        const data = await res.json();
        const tableBody = document.querySelector("#myComplaintsTable tbody");
        tableBody.innerHTML = "";

        data.forEach(comp => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${new Date(comp.created_at).toLocaleDateString()}</td>
                <td>${comp.category}</td>
                <td>${comp.description}</td>
                <td><span class="status-${comp.status.toLowerCase()}">${comp.status}</span></td>
            `;
        });
    } catch (err) { console.error(err); }
}

// 2. Submit New Complaint
document.getElementById("newComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    const complaintData = {
        resident_name: userData.name,
        house_no: userData.house_no,
        category: document.getElementById("compCategory").value,
        description: document.getElementById("compDescription").value
    };

    const res = await fetch(`${API_URL}/add-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintData)
    });

    if (res.ok) {
        alert("Complaint Submitted Successfully!");
        document.getElementById("complaintModal").style.display = "none";
        loadMyComplaints();
    }
};

// Modal Logic
const modal = document.getElementById("complaintModal");
document.getElementById("openComplaintBtn").onclick = () => modal.style.display = "block";
document.querySelector(".close-btn").onclick = () => modal.style.display = "none";

function logoutUser() {
    localStorage.removeItem("residentUser");
    window.location.href = "resident-login.html";
}

window.onload = loadMyComplaints;