/**
 * Dashboard Client Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session check and role validation
    const currentStaff = await checkAuthSession(['dept_head', 'admin']);
    if (!currentStaff) return;

    // DOM Elements
    const deptPickerOverlay = document.getElementById('dept-picker-overlay');
    const pickerSelect = document.getElementById('picker-select');
    const pickerSubmitBtn = document.getElementById('picker-submit-btn');
    
    const deptFilterWrapper = document.getElementById('dept-filter-wrapper');
    const typeFilterWrapper = document.getElementById('type-filter-wrapper');
    const deptSelect = document.getElementById('dept-select');
    const attendeeTypeSelect = document.getElementById('attendee-type-select');
    const sortSelect = document.getElementById('sort-select');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    // Stats Cards Elements
    const statTotalEntered = document.getElementById('stat-total-entered');
    const statTotalPercent = document.getElementById('stat-total-percent');
    const totalProgressBar = document.getElementById('total-progress-bar');
    
    const middleStatCard = document.getElementById('middle-stat-card');
    const middleStatTitle = document.getElementById('middle-stat-title');
    const statStudentsEntered = document.getElementById('stat-students-entered');
    const statStudentsPercent = document.getElementById('stat-students-percent');
    const studentsProgressBar = document.getElementById('students-progress-bar');
    
    const rightStatCard = document.getElementById('right-stat-card');
    const statGuardiansEntered = document.getElementById('stat-guardians-entered');
    const statGuardiansPercent = document.getElementById('stat-guardians-percent');
    const guardiansProgressBar = document.getElementById('guardians-progress-bar');
    
    // Tabs & Table Elements
    const tabs = document.querySelectorAll('.tabs .tab');
    const websocketBadge = document.getElementById('websocket-badge');
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    const countAll = document.getElementById('count-all');
    const countEntered = document.getElementById('count-entered');
    const countNotEntered = document.getElementById('count-not-entered');
    
    // Pagination Elements
    const paginationInfo = document.getElementById('pagination-info');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // Admin Panels
    const adminControlsCard = document.getElementById('admin-controls-card');
    const staffRegForm = document.getElementById('staff-reg-form');
    const regUsername = document.getElementById('reg-username');
    const regRole = document.getElementById('reg-role');
    const regPassword = document.getElementById('reg-password');
    const resetDbBtn = document.getElementById('reset-db-btn');
    const bulkUploadForm = document.getElementById('bulk-upload-form');
    const bulkFileInput = document.getElementById('bulk-file-input');
    const uploadStatus = document.getElementById('upload-status');
    const bulkUploadBtn = document.getElementById('bulk-upload-btn');

    // State parameters
    const currentRole = currentStaff.role;
    let activeDepartment = "";
    let activeType = "";
    let activeEnteredTab = "all"; // "all", "true", "false"
    let activeSort = "time"; // Default to time-based sorting
    let searchQuery = "";
    let currentPage = 0;
    const limit = 50;
    
    let totalStatsData = {};
    let usersData = [];
    let wsConnection = null;
    let lastCheckedInAdmission = null; // Track most recent WebSocket check-in for animation trigger

    // Set role-based UI properties (handled in hamburger/dropdown menus)
    
    // 2. Initialize Dashboard based on role
    if (currentRole === 'dept_head') {
        // Staff portal setups:
        // Hide standard filters (locked to their department and students only)
        deptFilterWrapper.style.display = 'none';
        typeFilterWrapper.style.display = 'none';
        
        // Hide Guardian stats card
        rightStatCard.style.display = 'none';
        // Adjust middle card title
        middleStatTitle.textContent = "Student Attendance Rate";
        
        // Update stats card layout to 2 columns on wide screens
        const statsGrid = document.querySelector('.grid-cols-3');
        if (statsGrid) {
            statsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        }

        // Fetch departments list first to populate the select picker overlay
        await loadDepartments(pickerSelect);
        
        // Render picker overlay
        deptPickerOverlay.classList.remove('hidden');
    } else {
        // Admin portal setups:
        adminControlsCard.style.display = 'grid';
        await loadDepartments(deptSelect);
        
        // Admin sees all by default
        activeDepartment = "";
        
        // Run initial data load
        initDashboardData();
    }

    // Load departments select options
    async function loadDepartments(selectElement) {
        try {
            const response = await secureFetch('/api/dashboard/departments');
            const data = await response.json();
            if (response.ok) {
                selectElement.innerHTML = '';
                
                if (selectElement === deptSelect) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'All Departments';
                    selectElement.appendChild(defaultOption);
                }
                
                data.departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    selectElement.appendChild(option);
                });
            }
        } catch (e) {
            console.error("Failed to fetch departments list: ", e);
        }
    }

    // Handle picker submit for staff
    pickerSubmitBtn.addEventListener('click', () => {
        const selectedDept = pickerSelect.value;
        if (!selectedDept) {
            Modal.show({
                title: 'Selection Required',
                message: 'Please select your department to access the student ledger.',
                type: 'warning'
            });
            return;
        }

        activeDepartment = selectedDept;
        deptSelect.value = selectedDept;
        
        // Hide overlay
        deptPickerOverlay.classList.add('hidden');
        
        // Load data
        initDashboardData();
    });

    function initDashboardData() {
        fetchStats();
        loadTableData();
        setupWebSocket();
    }

    // Fetch Stats Counters
    async function fetchStats() {
        try {
            let url = `/api/dashboard/stats`;
            if (activeDepartment) {
                url += `?department=${encodeURIComponent(activeDepartment)}`;
            }
            
            const response = await secureFetch(url);
            const stats = await response.json();
            
            if (response.ok) {
                totalStatsData = stats;
                renderStatsUI();
            }
        } catch (e) {
            console.error("Failed to load statistics: ", e);
        }
    }

    function renderStatsUI() {
        if (currentRole === 'dept_head') {
            // Staff statistics (Student focus)
            statTotalEntered.textContent = `${totalStatsData.students_entered} / ${totalStatsData.students_registered}`;
            statTotalPercent.textContent = `${calculatePercent(totalStatsData.students_entered, totalStatsData.students_registered)}% Checked-in`;
            totalProgressBar.style.width = `${calculatePercent(totalStatsData.students_entered, totalStatsData.students_registered)}%`;
            
            statStudentsEntered.textContent = `${totalStatsData.students_registered - totalStatsData.students_entered} Remaining`;
            statStudentsPercent.textContent = `Pending Entrance`;
            studentsProgressBar.style.width = `${100 - calculatePercent(totalStatsData.students_entered, totalStatsData.students_registered)}%`;
            studentsProgressBar.style.backgroundColor = 'var(--warning)';
        } else {
            // Admin statistics (Full roster focus)
            statTotalEntered.textContent = `${totalStatsData.total_entered} / ${totalStatsData.total_registered}`;
            statTotalPercent.textContent = `${totalStatsData.attendance_rate}% Check-in Rate`;
            totalProgressBar.style.width = `${totalStatsData.attendance_rate}%`;
            
            statStudentsEntered.textContent = `${totalStatsData.students_entered} / ${totalStatsData.students_registered}`;
            const studentPct = calculatePercent(totalStatsData.students_entered, totalStatsData.students_registered);
            statStudentsPercent.textContent = `${studentPct}% Students Checked-in`;
            studentsProgressBar.style.width = `${studentPct}%`;
            
            statGuardiansEntered.textContent = `${totalStatsData.guardians_entered} / ${totalStatsData.guardians_registered}`;
            const guardianPct = calculatePercent(totalStatsData.guardians_entered, totalStatsData.guardians_registered);
            statGuardiansPercent.textContent = `${guardianPct}% Guardians Checked-in`;
            guardiansProgressBar.style.width = `${guardianPct}%`;
        }
        
        // Update tab count labels
        countAll.textContent = currentRole === 'dept_head' ? totalStatsData.students_registered : totalStatsData.total_registered;
        countEntered.textContent = currentRole === 'dept_head' ? totalStatsData.students_entered : totalStatsData.total_entered;
        countNotEntered.textContent = currentRole === 'dept_head' ? 
            (totalStatsData.students_registered - totalStatsData.students_entered) : 
            (totalStatsData.total_registered - totalStatsData.total_entered);
    }

    function calculatePercent(part, total) {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    }

    // Load Users Table Data
    async function loadTableData(silent = false) {
        if (!silent) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <div class="spinner" style="margin-bottom: 0.5rem;"></div>
                        <div>Fetching roster details...</div>
                    </td>
                </tr>
            `;
        }
        
        try {
            // Build query params
            const params = new URLSearchParams();
            if (activeDepartment) params.append('department', activeDepartment);
            if (activeType) params.append('type', activeType);
            
            if (activeEnteredTab !== 'all') {
                params.append('entered', activeEnteredTab);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            
            params.append('sort_by', activeSort);
            params.append('skip', (currentPage * limit).toString());
            params.append('limit', limit.toString());
            
            const response = await secureFetch(`/api/dashboard/users?${params.toString()}`);
            const data = await response.json();
            
            if (response.ok) {
                usersData = data.users;
                renderTableHead();
                renderTableBody(data.total);
            } else {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to fetch users: ${data.detail || 'Unknown error'}</td></tr>`;
            }
        } catch (e) {
            console.error("Error loading table data: ", e);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to communicate with API server.</td></tr>`;
        }
    }

    function renderTableHead() {
        tableHead.innerHTML = '';
        const row = document.createElement('tr');
        
        if (currentRole === 'dept_head') {
            // Staff headers: Name, Register No, Admission No, Status, Contact
            row.innerHTML = `
                <th>Student Name</th>
                <th>Register No</th>
                <th>Admission No</th>
                <th>Status</th>
                <th style="text-align: center;">Contact</th>
            `;
        } else {
            // Admin headers: Photo, Register No, Admission No, Name, Type, Seat, Department, Status, Checked-in At
            row.innerHTML = `
                <th>Photo</th>
                <th>Register No</th>
                <th>Admission No</th>
                <th>Name</th>
                <th>Type</th>
                <th>Seat</th>
                <th>Department</th>
                <th>Status</th>
                <th>Checked-in At</th>
            `;
        }
        tableHead.appendChild(row);
    }

    function renderTableBody(totalCount) {
        tableBody.innerHTML = '';
        
        if (usersData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        No attendee records matching active filters.
                    </td>
                </tr>
            `;
            paginationInfo.textContent = "Showing 0 of 0";
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
            return;
        }

        usersData.forEach(user => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', user.id);
            tr.setAttribute('data-register', user.register_number);
            tr.setAttribute('data-admission', user.admission_number || '');

            // Apply fade-out exposure animation to newly checked in attendee
            if (user.register_number === lastCheckedInAdmission) {
                tr.classList.add('new-entry-highlight');
                setTimeout(() => {
                    tr.classList.remove('new-entry-highlight');
                }, 2600);
                lastCheckedInAdmission = null; // Clear tracker
            }

            const statusBadge = user.entered ? 
                '<span class="badge badge-entered">Checked In</span>' : 
                '<span class="badge badge-not-entered">Not Checked In</span>';
            
            if (currentRole === 'dept_head') {
                // Render Staff Columns: Name, Register No, Admission No, Status, Contact
                const phoneCallIcon = user.phone ? 
                    `<a href="tel:${user.phone}" class="call-btn" title="Call Student (${user.phone})">📞</a>` : 
                    '<span style="color: var(--text-muted); font-size: 0.85rem;">N/A</span>';
                
                tr.innerHTML = `
                    <td style="font-weight: 600;">${user.name}</td>
                    <td><code>${user.register_number}</code></td>
                    <td><code>${user.admission_number || 'N/A'}</code></td>
                    <td>${statusBadge}</td>
                    <td style="text-align: center;">${phoneCallIcon}</td>
                `;
            } else {
                // Render Admin Columns: Photo, Register No, Admission No, Name, Type, Seat, Department, Status, Checked-in At
                const typeBadge = user.type === 'student' ? 
                    '<span class="badge badge-student">Student</span>' : 
                    '<span class="badge badge-guardian">Guardian</span>';
                
                const photoSrc = user.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop';
                const timeString = user.scanned_at ? formatDateTime(user.scanned_at) : 'N/A';
                
                tr.innerHTML = `
                    <td><img src="${photoSrc}" alt="${user.name}" class="thumbnail"></td>
                    <td><code>${user.register_number}</code></td>
                    <td><code>${user.admission_number || 'N/A'}</code></td>
                    <td style="font-weight: 600;">${user.name}</td>
                    <td>${typeBadge}</td>
                    <td>${user.seat_number || 'N/A'}</td>
                    <td>${user.department || 'N/A'}</td>
                    <td>${statusBadge}</td>
                    <td style="font-size: 0.9rem; color: var(--text-secondary);">${timeString}</td>
                `;
            }
            
            tableBody.appendChild(tr);
        });

        // Update pagination UI controls
        const start = currentPage * limit + 1;
        const end = Math.min(start + usersData.length - 1, totalCount);
        paginationInfo.textContent = `Showing ${start}-${end} of ${totalCount}`;
        
        prevPageBtn.disabled = currentPage === 0;
        nextPageBtn.disabled = end >= totalCount;
    }

    // Filter Change Event Handlers
    deptSelect.addEventListener('change', () => {
        activeDepartment = deptSelect.value;
        currentPage = 0;
        fetchStats();
        loadTableData();
    });

    attendeeTypeSelect.addEventListener('change', () => {
        activeType = attendeeTypeSelect.value;
        currentPage = 0;
        loadTableData();
    });

    sortSelect.addEventListener('change', () => {
        activeSort = sortSelect.value;
        currentPage = 0;
        loadTableData();
    });

    // Search Trigger (Debounced Input & Clear)
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = searchInput.value.trim();
            currentPage = 0;
            loadTableData();
        }, 400);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        currentPage = 0;
        loadTableData();
    });

    // Tab Event Listeners
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeEnteredTab = tab.getAttribute('data-entered');
            currentPage = 0;
            loadTableData();
        });
    });

    // Pagination Click Listeners
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            loadTableData();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        loadTableData();
    });

    // 3. Real-Time WebSockets Integration
    function setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/checkins`;
        
        console.log(`Connecting to check-in WebSocket stream: ${wsUrl}`);
        wsConnection = new WebSocket(wsUrl);

        wsConnection.onopen = () => {
            console.log("WebSocket stream connected.");
            websocketBadge.style.display = 'inline-flex';
        };

        wsConnection.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'checkin') {
                    handleRealtimeCheckin(payload.data);
                }
            } catch (err) {
                console.error("Error decoding websocket broadcast: ", err);
            }
        };

        wsConnection.onclose = () => {
            console.warn("WebSocket disconnected. Reconnecting in 5 seconds...");
            websocketBadge.style.display = 'none';
            setTimeout(setupWebSocket, 5000); // Reconnect loop
        };

        wsConnection.onerror = (e) => {
            console.error("WebSocket socket error: ", e);
        };
    }

    function handleRealtimeCheckin(checkin) {
        // If staff dashboard: only process check-in if it belongs to their department
        if (currentRole === 'dept_head' && checkin.department !== activeDepartment) {
            return;
        }

        // Dynamically increment statistics counters locally without page reload
        if (checkin.type === 'student') {
            totalStatsData.students_entered++;
        } else if (checkin.type === 'guardian') {
            totalStatsData.guardians_entered++;
        }
        totalStatsData.total_entered++;
        
        // Re-render stats dashboard counters
        renderStatsUI();

        // Search if the checked-in user is currently rendered in the active table page
        const row = document.querySelector(`tr[data-register="${checkin.register_number}"]`);
        
        if (row) {
            // Find status cell and replace badge
            const statusCellIndex = currentRole === 'dept_head' ? 3 : 7;
            const statusCell = row.cells[statusCellIndex];
            if (statusCell) {
                statusCell.innerHTML = '<span class="badge badge-entered">Checked In</span>';
            }
            
            // Add Scanned At timestamp in admin panel
            if (currentRole === 'admin') {
                const scannedAtCell = row.cells[8];
                if (scannedAtCell) {
                    scannedAtCell.textContent = formatDateTime(checkin.scanned_at);
                }
            }

            // Trigger premium green row flash glow
            row.classList.add('new-entry-highlight');
            setTimeout(() => {
                row.classList.remove('new-entry-highlight');
            }, 2600);
        }

        // If the user sorted by Time, reload the table silently to bubble the active entry to top without flashing
        if (activeSort === 'time') {
            lastCheckedInAdmission = checkin.register_number;
            loadTableData(true);
        }
    }

    // 4. Admin Only Operations
    if (currentRole === 'admin') {
        // Handle Register Staff Submission
        staffRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                username: regUsername.value.trim(),
                role: regRole.value,
                password: regPassword.value
            };

            try {
                const response = await secureFetch('/api/admin/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    Modal.show({
                        title: 'Account Created',
                        message: `Successfully created staff login: <strong>${payload.username}</strong> with role ${payload.role}.`,
                        type: 'success'
                    });
                    staffRegForm.reset();
                } else {
                    Modal.show({
                        title: 'Registration Failed',
                        message: data.detail || 'Could not register staff member.',
                        type: 'danger'
                    });
                }
            } catch (err) {
                Modal.show({
                    title: 'Network Error',
                    message: 'Could not connect to API registration endpoint.',
                    type: 'danger'
                });
            }
        });

        // Danger Action: Wipe All Check-ins
        resetDbBtn.addEventListener('click', () => {
            Modal.show({
                title: 'Reset Check-in Logs?',
                message: 'Are you sure you want to clear ALL check-in history? Attendees will need to be re-scanned to enter. This action is irreversible.',
                type: 'danger',
                showCancel: true,
                onConfirm: async () => {
                    try {
                        const response = await secureFetch('/api/admin/reset-entries', {
                            method: 'POST'
                        });
                        const data = await response.json();
                        
                        if (response.ok) {
                            Modal.show({
                                title: 'Wipe Complete',
                                message: data.message,
                                type: 'success'
                            });
                            initDashboardData();
                        } else {
                            Modal.show({
                                title: 'Wipe Failed',
                                message: data.detail || 'Could not reset logs.',
                                type: 'danger'
                            });
                        }
                    } catch (e) {
                        Modal.show({
                            title: 'Network Error',
                            message: 'Could not execute wipe database command.',
                            type: 'danger'
                        });
                    }
                }
            });
        });

        // Bulk Upload Form Submission
        bulkUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = bulkFileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            bulkUploadBtn.disabled = true;
            bulkUploadBtn.textContent = 'Importing...';
            uploadStatus.style.display = 'block';
            uploadStatus.style.color = 'var(--text-secondary)';
            uploadStatus.textContent = 'Uploading and processing file...';

            try {
                const response = await secureFetch('/api/admin/upload-participants', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                
                if (response.ok) {
                    Modal.show({
                        title: 'Import Successful',
                        message: `Successfully imported <strong>${data.imported_students}</strong> students and <strong>${data.imported_guardians}</strong> guardians.`,
                        type: 'success'
                    });
                    bulkUploadForm.reset();
                    uploadStatus.style.color = 'var(--success)';
                    uploadStatus.textContent = 'Import completed successfully!';
                    
                    // Reload the table and stats
                    initDashboardData();
                } else {
                    Modal.show({
                        title: 'Import Failed',
                        message: data.detail || 'Could not parse or import participants file.',
                        type: 'danger'
                    });
                    uploadStatus.style.color = 'var(--danger)';
                    uploadStatus.textContent = 'Import failed.';
                }
            } catch (err) {
                console.error(err);
                Modal.show({
                    title: 'Network Error',
                    message: 'Could not connect to the upload API endpoint.',
                    type: 'danger'
                });
                uploadStatus.style.color = 'var(--danger)';
                uploadStatus.textContent = 'Network error occurred.';
            } finally {
                bulkUploadBtn.disabled = false;
                bulkUploadBtn.textContent = 'Upload & Import';
            }
        });
    }
});
