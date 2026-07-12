/**
 * Common Utilities and Secure API Client
 */

// Custom Modal System
const Modal = {
    _create() {
        let overlay = document.getElementById('custom-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'custom-modal-overlay';
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div id="modal-icon-container" class="modal-icon"></div>
                        <h3 id="modal-title-text" class="modal-title">Notification</h3>
                    </div>
                    <div id="modal-body-text" class="modal-body"></div>
                    <div class="modal-footer">
                        <button id="modal-cancel-btn" class="btn btn-secondary" style="display: none; margin-right: 0.5rem;">Cancel</button>
                        <button id="modal-close-btn" class="btn btn-primary">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        return overlay;
    },

    show({ title, message, type = 'info', showCancel = false, onConfirm = null }) {
        const overlay = this._create();
        const iconContainer = document.getElementById('modal-icon-container');
        const titleText = document.getElementById('modal-title-text');
        const bodyText = document.getElementById('modal-body-text');
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        // Reset classes
        iconContainer.className = 'modal-icon ' + type;

        // Icon content
        if (type === 'success') {
            iconContainer.innerHTML = '✓';
            closeBtn.className = 'btn btn-success';
        } else if (type === 'danger') {
            iconContainer.innerHTML = '✕';
            closeBtn.className = 'btn btn-danger';
        } else if (type === 'warning') {
            iconContainer.innerHTML = '⚠';
            closeBtn.className = 'btn btn-primary';
        } else {
            iconContainer.innerHTML = 'ℹ';
            closeBtn.className = 'btn btn-secondary';
        }

        titleText.innerHTML = title;
        bodyText.innerHTML = message;

        if (showCancel) {
            cancelBtn.style.display = 'inline-block';
            closeBtn.textContent = 'Confirm';
        } else {
            cancelBtn.style.display = 'none';
            closeBtn.textContent = 'Close';
        }

        // Open modal
        overlay.classList.add('active');

        // Event handler clean-up function
        const cleanUp = () => {
            overlay.classList.remove('active');
            closeBtn.removeEventListener('click', confirmAction);
            cancelBtn.removeEventListener('click', cancelAction);
            overlay.removeEventListener('click', overlayClickAction);
        };

        const confirmAction = () => {
            cleanUp();
            if (onConfirm) onConfirm();
        };

        const cancelAction = () => {
            cleanUp();
        };

        const overlayClickAction = (e) => {
            if (e.target === overlay) {
                cleanUp();
            }
        };

        closeBtn.addEventListener('click', confirmAction);
        cancelBtn.addEventListener('click', cancelAction);
        overlay.addEventListener('click', overlayClickAction);
    }
};

// API Fetch Interceptor
async function secureFetch(url, options = {}) {
    options.credentials = 'include'; // Ensure cookies are sent
    options.headers = options.headers || {};

    // Set content type if JSON body
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    try {
        let response = await fetch(url, options);

        // Auto refresh access token on 401
        if (response.status === 401 && !url.includes('/api/auth/refresh') && !url.includes('/api/auth/login')) {
            console.log('[*] Access token expired, attempting refresh token rotation...');

            const refreshRes = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include'
            });

            if (refreshRes.ok) {
                console.log('[+] Token refreshed successfully, retrying original request.');
                // Retry original request
                response = await fetch(url, options);
            } else {
                console.log('[!] Refresh failed. Session expired. Redirecting to login.');
                // If on login page, don't redirect
                if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
                    window.location.href = '/login';
                }
                throw new Error("Session expired. Please log in again.");
            }
        }

        return response;
    } catch (err) {
        console.error('[!] Network or Server Error: ', err);
        throw err;
    }
}

// Session Validation Helper
async function checkAuthSession(allowedRoles = []) {
    try {
        const response = await secureFetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login';
            return null;
        }

        const user = await response.json();

        // Check role permission
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            Modal.show({
                title: 'Access Denied',
                message: 'You do not have permission to view this page. Redirecting...',
                type: 'danger',
                onConfirm: () => {
                    if (user.role === 'security') window.location.href = '/scanner';
                    else if (user.role === 'dept_head' || user.role === 'admin') window.location.href = '/dashboard';
                    else window.location.href = '/login';
                }
            });
            return null;
        }

        // Render Navbar user profile details
        renderNavBar(user);
        return user;
    } catch (e) {
        window.location.href = '/login';
        return null;
    }
}

// Render Shared Navigation Bar
function renderNavBar(user) {
    const header = document.querySelector('header');
    if (!header) return;

    if (!user) {
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="logo-container" style="cursor: pointer;" onclick="window.location.href='/'">
                    <div class="logo-icon">C</div>
                    <span class="logo-text">Convocation 2026</span>
                    <span class="logo-badge">Guest Mode</span>
                </div>
            </div>
            <div>
                
            </div>
        `;
        return;
    }

    let dashboardLink = '';
    let scannerLink = '';

    if (user.role === 'admin' || user.role === 'dept_head') {
        dashboardLink = `<a href="/dashboard" class="drawer-nav-item ${window.location.pathname.includes('/dashboard') ? 'active' : ''}">📊 Dashboard</a>`;
    }
    if (user.role === 'admin' || user.role === 'security') {
        scannerLink = `<a href="/scanner" class="drawer-nav-item ${window.location.pathname.includes('/scanner') ? 'active' : ''}">📷 QR Scanner</a>`;
    }

    let settingsLink = '';
    if (user.role === 'admin') {
        settingsLink = `<a href="/settings" class="drawer-nav-item ${window.location.pathname.includes('/settings') ? 'active' : ''}">⚙️ Settings</a>`;
    }

    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <button id="hamburger-btn" class="hamburger-btn" aria-label="Menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="logo-container" style="cursor: pointer;" onclick="window.location.href='/'">
                <div class="logo-icon">C</div>
                <span class="logo-text">Convocation 2026</span>
            </div>
        </div>
        
        <div class="profile-dropdown-container">
            <div class="user-avatar-btn" id="user-avatar-btn">
                ${user.username.substring(0, 2).toUpperCase()}
            </div>
            
            <div class="profile-dropdown" id="profile-dropdown">
                <div class="dropdown-header">
                    <span class="dropdown-username">${user.username}</span>
                    <span class="dropdown-role">${user.role.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style="border-top: 1px solid var(--border-color); margin: 0.75rem 0;"></div>
                <button id="logout-btn" class="btn-logout-dropdown">🚪 Sign Out</button>
            </div>
        </div>
    `;

    // Remove any existing drawer elements to avoid duplicates on re-render
    const oldOverlay = document.getElementById('drawer-overlay');
    if (oldOverlay) oldOverlay.remove();
    const oldDrawer = document.getElementById('nav-drawer');
    if (oldDrawer) oldDrawer.remove();

    // Create and append drawer elements directly to document.body
    const drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'drawer-overlay';
    drawerOverlay.className = 'drawer-overlay';
    document.body.appendChild(drawerOverlay);

    const welcomeLink = `<a href="/welcome" class="drawer-nav-item ${window.location.pathname.includes('/welcome') ? 'active' : ''}">👋 Welcome Screen</a>`;

    const navDrawer = document.createElement('div');
    navDrawer.id = 'nav-drawer';
    navDrawer.className = 'nav-drawer';
    navDrawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div class="logo-container">
                <div class="logo-icon">C</div>
                <span class="logo-text">Menu</span>
            </div>
            <button id="drawer-close-btn" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; line-height: 1;">✕</button>
        </div>
        <nav class="drawer-nav-links">
            ${dashboardLink}
            ${scannerLink}
            ${settingsLink}
            ${welcomeLink}
        </nav>
    `;
    document.body.appendChild(navDrawer);

    // Toggle Drawer
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');

    const toggleDrawer = (state) => {
        if (state) {
            navDrawer.classList.add('active');
            drawerOverlay.classList.add('active');
        } else {
            navDrawer.classList.remove('active');
            drawerOverlay.classList.remove('active');
        }
    };

    hamburgerBtn.addEventListener('click', () => toggleDrawer(true));
    drawerCloseBtn.addEventListener('click', () => toggleDrawer(false));
    drawerOverlay.addEventListener('click', () => toggleDrawer(false));

    // Profile Dropdown Toggle
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        profileDropdown.classList.remove('show');
    });

    profileDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Logout Action
    document.getElementById('logout-btn').addEventListener('click', async () => {
        const response = await secureFetch('/api/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            Modal.show({
                title: 'Logout Failed',
                message: 'An error occurred during logout.',
                type: 'danger'
            });
        }
    });
}

// Format Datetime string helper
function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' +
        date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
