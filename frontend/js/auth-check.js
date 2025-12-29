function applyGlobalSecurity() {
    const userRaw = localStorage.getItem("adminUser");
    
    // 1. Session Check
    if (!userRaw) {
        window.location.href = "login.html";
        return;
    }

    const currentUser = JSON.parse(userRaw);
    const role = currentUser.role; // accountant, security, super_admin
    const path = window.location.pathname;
    const page = path.split("/").pop();

    console.log("Global Security Active. Role:", role, "Page:", page);

    // --- 🛡️ REDIRECTION (Dhaka Logic) ---
    // Agar koi manually URL type karke ghusne ki koshish kare
    if (role === 'accountant') {
        // Accountant ke liye ab expenses.html bhi allow list mein hai
        const allowed = ["dashboard.html", "billing.html", "expenses.html", "login.html", ""];
        if (!allowed.includes(page) && page !== "") {
            window.location.href = "dashboard.html";
            return;
        }
    }

    if (role === 'security') {
        // Security guard sirf security logs aur dashboard dekh sakta hai
        const allowed = ["dashboard.html", "security.html", "login.html", ""];
        if (!allowed.includes(page) && page !== "") {
            window.location.href = "dashboard.html";
            return;
        }
    }

    // --- ✂️ HIDING UI (Sidebar/Cards) ---
    const styleId = "role-hiding-style";
    let style = document.getElementById(styleId);
    
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }

    const hide = (id) => {
        try {
            style.sheet.insertRule(`${id} { display: none !important; }`, 0);
        } catch (e) {
            // Rule already exists or selector error
        }
    };

    if (role === 'accountant') {
        // Hide only unauthorized sections
        hide('#nav-residents'); 
        hide('#nav-complaints'); 
        hide('#nav-security');
        hide('#nav-staff'); 
        hide('#nav-admin'); 
        hide('#card-residents');
        hide('#card-security'); 
        hide('#card-complaints'); 
        hide('#btn-broadcast');
        hide('#btn-billing'); 
    }

    if (role === 'security') {
        // Hide financials and management for security
        hide('#nav-residents'); 
        hide('#nav-billing'); 
        hide('#nav-complaints');
        hide('#nav-staff'); 
        hide('#nav-admin'); 
        hide('#card-residents');
        hide('#card-billing'); 
        hide('#card-complaints'); 
        hide('#btn-billing');
        hide('#btn-broadcast'); 
        hide('#chart-revenue'); 
        hide('.recent-section');
    }

    // Universal: No one except super_admin sees Admin Settings
    if (role !== 'super_admin') { 
        hide('#nav-admin'); 
    }
}

// Page load hote hi chalao
applyGlobalSecurity();

// Sidebar load hone mein time leta hai, isliye 3 second tak har 100ms baad chalao
let securityTimer = setInterval(applyGlobalSecurity, 100);
setTimeout(() => clearInterval(securityTimer), 3000);