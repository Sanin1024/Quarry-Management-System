// Shared utilities for Quarry Tracker Finance Dashboard

// Default mock records for Quarry 1
const DEFAULT_Q1_RECORDS = [
    {
        id: "Q1-WP-1024",
        periodFrom: "2023-10-01",
        periodTo: "2023-10-15",
        workingDays: 14,
        laborers: 12,
        laborPay: 85000,
        diesel: 45000,
        spares: 12000,
        jcb: 30000,
        mess: 15000,
        fitting: 0,
        cuttingWheel: 0,
        other: 0,
        firstQty: 15000,
        secondQty: 4000,
        broken: 2,
        totalExp: 187000,
        totalRev: 450000,
        netValue: 263000,
        status: "Fully Received",
        outstanding: 0,
        received: 450000
    },
    {
        id: "Q1-WP-1025",
        periodFrom: "2023-10-16",
        periodTo: "2023-10-31",
        workingDays: 15,
        laborers: 14,
        laborPay: 92000,
        diesel: 48000,
        spares: 8000,
        jcb: 32000,
        mess: 16000,
        fitting: 0,
        cuttingWheel: 0,
        other: 0,
        firstQty: 16000,
        secondQty: 3500,
        broken: 1,
        totalExp: 196000,
        totalRev: 475000,
        netValue: 279000,
        status: "Partially Received",
        outstanding: 125000,
        received: 350000
    }
];

// Default mock records for Quarry 2 (empty state initially)
const DEFAULT_Q2_RECORDS = [];

// Initialize Database on Page Load
function initializeDatabase() {
    if (!localStorage.getItem('quarry_records_q1')) {
        localStorage.setItem('quarry_records_q1', JSON.stringify(DEFAULT_Q1_RECORDS));
    }
    if (!localStorage.getItem('quarry_records_q2')) {
        localStorage.setItem('quarry_records_q2', JSON.stringify(DEFAULT_Q2_RECORDS));
    }
}

// Get records from localStorage
function getQuarryRecords(quarryId) {
    initializeDatabase();
    const data = localStorage.getItem(`quarry_records_${quarryId}`);
    return data ? JSON.parse(data) : [];
}

// Save records to localStorage
function saveQuarryRecords(quarryId, records) {
    localStorage.setItem(`quarry_records_${quarryId}`, JSON.stringify(records));
}

// Format Currency to Indian Rupee (INR) style
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Theme Toggle Manager
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Bind event listeners to theme toggler buttons
    // Find theme buttons on current page
    document.querySelectorAll('button').forEach(btn => {
        if (btn.querySelector('.material-symbols-outlined') && 
            btn.querySelector('.material-symbols-outlined').textContent.trim() === 'dark_mode') {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleTheme();
            });
        }
    });
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Navigation Dynamic Bindings
function bindNavigation() {
    // Bind <a> tags based on their text content
    document.querySelectorAll('a').forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (text.includes('dashboard')) {
            link.href = 'dashboard.html';
        } else if (text.includes('quarry 1')) {
            link.href = 'quarry1.html';
        } else if (text.includes('quarry 2')) {
            link.href = 'quarry2.html';
        } else if (text.includes('compare')) {
            link.href = 'comparison.html';
        } else if (text.includes('import data') || text.includes('import excel')) {
            link.href = 'import.html';
        } else if (text.includes('reports')) {
            link.href = 'reports.html';
        }
    });

    // Bind specific buttons
    document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('new entry') || text.includes('add working period')) {
            btn.addEventListener('click', () => {
                // Determine pre-selected quarry if possible
                const isQ2Page = window.location.pathname.includes('quarry2');
                window.location.href = isQ2Page ? 'add_entry.html?quarry=q2' : 'add_entry.html?quarry=q1';
            });
        } else if (text.includes('import excel')) {
            btn.addEventListener('click', () => {
                window.location.href = 'import.html';
            });
        }
    });
}

// Show a sleek toast message
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-20 right-8 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2`;
    
    if (type === 'success') {
        toast.className += ' bg-success';
        toast.innerHTML = `<span class="material-symbols-outlined">check_circle</span> ${message}`;
    } else if (type === 'error') {
        toast.className += ' bg-error';
        toast.innerHTML = `<span class="material-symbols-outlined">error</span> ${message}`;
    } else {
        toast.className += ' bg-secondary';
        toast.innerHTML = `<span class="material-symbols-outlined">info</span> ${message}`;
    }

    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// On DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeDatabase();
    initTheme();
    bindNavigation();
});
