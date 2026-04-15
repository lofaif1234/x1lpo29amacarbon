let executors = [];
let games = [];

// ===== INIT VARIABLES FIRST =====
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');
const homeExecutorsList = document.getElementById('home-executors-list');
const homeGamesList = document.getElementById('home-games-list');

// ===== SOCKET.IO SETUP =====
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('initial_data', (data) => {
        executors = data.executors || [];
        games = data.games || [];
        renderAll();
    });
    socket.on('data_updated', (data) => {
        executors = data.executors || [];
        games = data.games || [];
        renderAll();
    });
} else {
    // Socket.IO not available fallback
}

// Variables will be declared and populated below


function setSectionVisibility(sectionId) {
    const gotSection = document.getElementById(sectionId);
    if (!gotSection) return;

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    gotSection.style.display = 'block';
    gotSection.classList.add('active');
    gotSection.style.opacity = '1';
    gotSection.style.transform = 'none';
}

function setActiveTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('data-tab') === tabId);
    });
}

function activateTab(tabId) {
    if (!tabId) return;

    setActiveTab(tabId);

    if (tabId === 'key' || tabId === 'credits') {
        setSectionVisibility(`view-${tabId}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    setSectionVisibility('view-home');

    let scrollTarget = 'section-hero';
    if (tabId === 'download') scrollTarget = 'section-executors';
    if (tabId === 'premium') scrollTarget = 'section-premium';

    const targetElement = document.getElementById(scrollTarget);
    if (!targetElement) return;

    const offset = 120;
    const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
}

function scrollToSection(id) {
    activateTab('home');
    const targetElement = document.getElementById(id);
    if (!targetElement) return;

    setTimeout(() => {
        const offset = 120;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }, 50);
}

// ===== NAV INIT - MUST RUN EARLY AND RELIABLY =====

const initNavigation = () => {

    // Delegate click handler on body to capture all nav clicks
    document.addEventListener('click', (e) => {
        // Check if click target is inside nav
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        const tabId = navItem.getAttribute('data-tab');
        if (!tabId) return;

        e.preventDefault();
        e.stopPropagation();

        activateTab(tabId);
    }, true); // Use capture phase to catch clicks early
};

// Run immediately if DOM ready, else queue for DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}
function renderAll() {
    renderHomeExecutors();
    renderHomeGames();
}
function renderHomeExecutors() {
    if (!homeExecutorsList) return;
    homeExecutorsList.innerHTML = '';
    executors.forEach(exe => {
        const item = document.createElement('div');
        item.className = 'executor-item';
        const statusClass = exe.status === 'Online' ? 'status-online' :
            exe.status === 'Updating' ? 'status-updating' : 'status-offline';
        const typeClass = exe.type === 'Paid' ? 'type-paid' : 'type-free';
        item.innerHTML = `
            <div class="executor-info">
                <h4>${exe.name}</h4>
                <div class="executor-meta">
                    <span class="meta-badge">UNC: ${exe.unc || '??'}</span>
                    <span class="meta-badge">sUNC: ${exe.sunc || '??'}</span>
                    <span class="meta-badge ${typeClass}">${exe.type}</span>
                </div>
            </div>
            <div class="status-badge ${statusClass}">
                ${exe.status}
            </div>
        `;
        homeExecutorsList.appendChild(item);
    });
}
function renderHomeGames() {
    if (!homeGamesList) return;
    homeGamesList.innerHTML = '';
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.innerHTML = `
            <img src="${game.logo}" alt="${game.title}" class="game-logo" onerror="this.src='https://via.placeholder.com/400x200?text=No+Logo'">
            <div class="game-info">
                <h4>${game.title}</h4>
                <p title="${game.description}">${game.description}</p>
                <a href="${game.link}" target="_blank" class="btn-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    View Details
                </a>
            </div>
        `;
        homeGamesList.appendChild(card);
    });
}

// ===== CALL RENDERALL AFTER ALL FUNCTIONS DEFINED =====
const renderAllOnDOMReady = () => {
    if (homeExecutorsList && homeGamesList) {
        renderAll();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAllOnDOMReady);
} else {
    renderAllOnDOMReady();
}

const purchaseBtn = document.getElementById('btn-purchase-lifetime');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const modalHeader = document.querySelector('.modal-header h3');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');
if (purchaseBtn) {
    purchaseBtn.addEventListener('click', () => {
        modalHeader.innerText = 'Purchase Information';
        modalMessage.innerHTML = 'To purchase the Lifetime Key, please add <strong style="color:var(--primary)">2.0</strong> on Discord.';
        modalOverlay.classList.add('active');
        modalConfirm.innerText = 'Got it';
        modalCancel.style.display = 'none';
        const closeBtn = () => {
            modalOverlay.classList.remove('active');
            modalConfirm.removeEventListener('click', closeBtn);
        };
        modalConfirm.addEventListener('click', closeBtn);
    });
}
modalCancel.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});
let revealObserver;
const scrollReveal = () => {
    if (!('IntersectionObserver' in window)) {
        // Older browsers or blocked environment: show all content immediately
        document.querySelectorAll('.rev-item').forEach(el => el.classList.add('animated'));
        return;
    }

    const observerOptions = {
        threshold: 0.01,
        rootMargin: '0px'
    };
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    document.querySelectorAll('.rev-item').forEach(el => revealObserver.observe(el));
};
document.addEventListener('DOMContentLoaded', scrollReveal);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    scrollReveal();
}
// Custom cursor implementation removed to allow native cursor behavior
window.updateCursorHovers = () => {
    // no-op since custom cursor is removed
};
function createBackgroundParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 4 + 2;
        const duration = Math.random() * 20 + 10;
        const opacity = Math.random() * 0.4 + 0.1;
        const drift = (Math.random() - 0.5) * 200;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.setProperty('--duration', `${duration}s`);
        particle.style.setProperty('--opacity', opacity);
        particle.style.setProperty('--drift', `${drift}px`);
        particle.style.animationDelay = `${Math.random() * -20}s`;
        container.appendChild(particle);
    }
}
if (typeof renderHomeExecutors === 'function') {
    const originalRenderHomeExecutors = renderHomeExecutors;
    renderHomeExecutors = function () {
        originalRenderHomeExecutors();
        if (window.updateCursorHovers) window.updateCursorHovers();
    };
}
if (typeof renderHomeGames === 'function') {
    const originalRenderHomeGames = renderHomeGames;
    renderHomeGames = function () {
        originalRenderHomeGames();
        if (window.updateCursorHovers) window.updateCursorHovers();
    };
}
function startApp() {
    scrollReveal();
    createBackgroundParticles();
    if (window.updateCursorHovers) window.updateCursorHovers();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
