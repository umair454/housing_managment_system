const API_URL = "http://localhost:5000";

// 1. Saare Bills Load Karne Ka Function
async function loadBills() {
    try {
        const response = await fetch(`${API_URL}/all-bills`);
        const data = await response.json();
        
        const tableBody = document.getElementById("billingTableBody"); 
        
        if (tableBody) {
            tableBody.innerHTML = ""; 
            if (data.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 20px;'>No bills found.</td></tr>";
                return;
            }
            data.forEach(bill => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${bill.name}</td>
                    <td>${bill.house_no}</td>
                    <td>Rs. ${Number(bill.amount).toLocaleString()}</td>
                    <td>${bill.bill_month}</td>
                    <td>${new Date(bill.due_date).toLocaleDateString()}</td> 
                    <td><span class="status-${bill.payment_status.toLowerCase()}">${bill.payment_status}</span></td>
                    <td>
                        <button class="edit-btn" style="background:#3b82f6; border-color:#3b82f6; color:white; cursor:pointer;" onclick='printBill(${JSON.stringify(bill).replace(/'/g, "&apos;")})'>
                            <i class="fa fa-print"></i> Print
                        </button>
                        ${bill.payment_status === 'Unpaid' 
                            ? `<button class="edit-btn" style="background:#10b981; border-color:#10b981; margin-left:5px; cursor:pointer;" onclick='markAsPaid(${JSON.stringify(bill).replace(/'/g, "&apos;")})'>
                                <i class="fa fa-check"></i> Paid
                               </button>` 
                            : '<span style="color:#10b981; margin-left:10px; font-weight:bold;">Paid ✅</span>'}
                    </td>
                `;
            });
        }
    } catch (err) {
        console.error("❌ Billing Load Error:", err);
    }
}

// 2. Bill ko "Paid" karne ka function
async function markAsPaid(bill) {
    if (!confirm(`Confirm payment of Rs. ${bill.amount} for House ${bill.house_no}?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/update-bill-status/${bill.bill_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                status: 'Paid',
                resident_id: bill.resident_id, // WhatsApp notification ke liye backend ko chahiye ho sakta hai
                amount: bill.amount,
                bill_month: bill.bill_month
            })
        });

        if (response.ok) {
            alert("✅ Payment Received Successfully!");
            loadBills(); // Table refresh karein
        } else {
            alert("❌ Failed to update payment status.");
        }
    } catch (err) {
        console.error("❌ Update Error:", err);
        alert("❌ Server connection error!");
    }
}

// --- Bill Print Function ---
function printBill(bill) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Receipt - ${bill.house_no}</title>
            <style>
                body { font-family: sans-serif; padding: 30px; line-height: 1.6; color: #333; }
                .receipt { border: 2px solid #333; padding: 20px; max-width: 500px; margin: auto; border-radius: 10px; }
                .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
                .total { font-size: 22px; font-weight: bold; margin-top: 20px; text-align: right; color: #10b981; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2 style="margin:0;">HMS HUB SOCIETY</h2>
                    <p style="margin:5px 0;">Maintenance Bill Receipt</p>
                </div>
                <div class="row"><span>Resident:</span> <strong>${bill.name}</strong></div>
                <div class="row"><span>House No:</span> <strong>${bill.house_no}</strong></div>
                <div class="row"><span>Bill Month:</span> <strong>${bill.bill_month}</strong></div>
                <div class="row"><span>Due Date:</span> <strong>${new Date(bill.due_date).toLocaleDateString()}</strong></div>
                <div class="row"><span>Payment Status:</span> <strong style="color:#10b981;">${bill.payment_status}</strong></div>
                <div class="total">Total Paid: Rs. ${Number(bill.amount).toLocaleString()}</div>
                <div class="footer">
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <p>This is a computer generated receipt.</p>
                </div>
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// 3. Search Filter Function
function filterBills() {
    let input = document.getElementById("billSearch").value.toUpperCase();
    let table = document.getElementById("billingTable");
    let tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let text = tr[i].textContent || tr[i].innerText;
        tr[i].style.display = text.toUpperCase().indexOf(input) > -1 ? "" : "none";
    }
}

// Page load hotay hi function chalayein
window.onload = loadBills;