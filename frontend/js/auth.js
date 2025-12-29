console.log("JS File Connected with Database Login!");

window.onload = function() {
    const loginForm = document.getElementById('loginForm');
    
    if(loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // HTML mein input ki ID 'email' hai isliye wahi use kar rahe hain
            const username = document.getElementById('email').value; 
            const password = document.getElementById('password').value;

            try {
                // 1. Server se login check karwana
                const response = await fetch('http://localhost:5000/admin-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (data.success) {
                    // 2. Session status save karein
                    localStorage.setItem("isLoggedIn", "true");
                    
                    // 3. 🔥 ROLE SAVE KAREIN: Taake auth-check.js ko pata chal sake
                    localStorage.setItem("adminUser", JSON.stringify(data.user));
                    
                    alert(`Login Successful! Role: ${data.user.role}`);
                    window.location.href = "dashboard.html"; 
                } else {
                    alert(data.message || "Ghalat Username ya Password!");
                }
            } catch (error) {
                console.error("Login Error:", error);
                alert("Server se connection fail! Pehle 'node server.js' chalaein.");
            }
        });
    } else {
        // Dashboard Security Check
        if (!window.location.href.includes("login.html") && localStorage.getItem("isLoggedIn") !== "true") {
            window.location.href = "login.html";
        }
    }
};

function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminUser");
    window.location.href = "login.html";
}