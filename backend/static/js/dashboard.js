const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification (Optional for guest dashboard access)
    let currentStaff = null;
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            currentStaff = await response.json();
        }
    } catch (e) {
        console.log("Running in guest mode.");
    }
    renderNavBar(currentStaff);

    // 2. Show and handle Admin Import Panel if admin
    const importPanel = document.getElementById('import-panel');
    if (currentStaff && currentStaff.role === 'admin' && importPanel) {
        importPanel.style.display = 'block';

        const importForm = document.getElementById('import-form');
        const importFileInput = document.getElementById('import-file-input');
        const importSubmitBtn = document.getElementById('import-submit-btn');
        const importStatus = document.getElementById('import-status');

        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const file = importFileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            importSubmitBtn.disabled = true;
            importSubmitBtn.textContent = 'Importing...';
            importStatus.textContent = '';
            importStatus.style.color = 'var(--text-secondary)';

            try {
                const response = await secureFetch('/api/admin/upload-participants', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    importStatus.textContent = result.message || 'Import completed successfully!';
                    importStatus.style.color = 'var(--success)';
                    importForm.reset();

                    // Refresh stats and table data
                    await refreshDashboard();
                } else {
                    importStatus.textContent = result.detail || 'Import failed. Check format.';
                    importStatus.style.color = 'var(--danger)';
                }
            } catch (err) {
                console.error(err);
                importStatus.textContent = 'Connection error.';
                importStatus.style.color = 'var(--danger)';
            } finally {
                importSubmitBtn.disabled = false;
                importSubmitBtn.textContent = 'Upload & Import';
            }
        });
    }

    // DOM Elements
    const deptSelect = document.getElementById('dept-select');
    const attendeeTypeSelect = document.getElementById('attendee-type-select');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const tabs = document.querySelectorAll('.tab');
    const tableBody = document.getElementById('table-body');

    // Stats elements
    const statTotalEntered = document.getElementById('stat-total-entered');
    const statTotalPercent = document.getElementById('stat-total-percent');
    const totalProgressBar = document.getElementById('total-progress-bar');

    const statStudentsEntered = document.getElementById('stat-students-entered');
    const statStudentsPercent = document.getElementById('stat-students-percent');
    const studentsProgressBar = document.getElementById('students-progress-bar');

    const statGuardiansEntered = document.getElementById('stat-guardians-entered');
    const statGuardiansPercent = document.getElementById('stat-guardians-percent');
    const guardiansProgressBar = document.getElementById('guardians-progress-bar');

    // Tab count badges
    const countAll = document.getElementById('count-all');
    const countEntered = document.getElementById('count-entered');
    const countNotEntered = document.getElementById('count-not-entered');

    // Pagination elements
    const paginationInfo = document.getElementById('pagination-info');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // State Variables
    let currentDept = "";
    let currentType = "";
    let currentEnteredFilter = "all"; // 'all', 'true', 'false'
    let currentSearch = "";
    let skip = 0;
    const limit = 25;
    let debounceTimer = null;

    // Restrict guest and department head dashboards to student data only and adjust layout
    if (!currentStaff || currentStaff.role === 'dept_head') {
        currentType = 'student';
        const typeFilterItem = document.getElementById('type-filter-item');
        const guardianCard = document.getElementById('guardian-card');
        const statsGrid = document.getElementById('stats-grid');

        if (typeFilterItem) typeFilterItem.style.display = 'none';
        if (guardianCard) guardianCard.style.display = 'none';
        if (statsGrid) {
            statsGrid.classList.remove('grid-cols-3');
            statsGrid.classList.add('grid-cols-2');
        }
    }

    // Initialize Dashboard
    const modalOverlay = document.getElementById('dept-modal-overlay');
    const modalDeptSelect = document.getElementById('modal-dept-select');
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    const modalContent = document.getElementById('dept-modal-content');

    // Populate departments lists
    await loadDepartments();

    // Helper to populate the modal select dropdown
    function populateModalDeptSelect() {
        modalDeptSelect.innerHTML = '';

        // If admin or guest, allow "All Departments" option
        if (!currentStaff || currentStaff.role === 'admin') {
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = 'All Departments';
            modalDeptSelect.appendChild(allOpt);
        }

        // Copy options from main select (skipping the "All Departments" placeholder)
        Array.from(deptSelect.options).forEach(opt => {
            if (opt.value !== '') {
                const copyOpt = document.createElement('option');
                copyOpt.value = opt.value;
                copyOpt.textContent = opt.textContent;
                modalDeptSelect.appendChild(copyOpt);
            }
        });
    }

    if (currentStaff && currentStaff.role === 'dept_head') {
        // If department head, bypass modal and immediately load their department data
        if (deptSelect.options.length > 0) {
            // Pick their restricted department (which is the only option in the list)
            const firstValidOpt = Array.from(deptSelect.options).find(o => o.value !== '');
            if (firstValidOpt) {
                currentDept = firstValidOpt.value;
                deptSelect.value = currentDept;
            }
        }
        await refreshDashboard();
    } else {
        // Show selection modal
        populateModalDeptSelect();
        modalOverlay.style.display = 'flex';
        // Trigger reflow for transition animation
        void modalOverlay.offsetWidth;
        modalOverlay.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';

        modalSubmitBtn.addEventListener('click', async () => {
            currentDept = modalDeptSelect.value;
            deptSelect.value = currentDept;

            // Animate out
            modalOverlay.style.opacity = '0';
            modalContent.style.transform = 'scale(0.95)';
            setTimeout(async () => {
                modalOverlay.style.display = 'none';
                await refreshDashboard();
            }, 300);
        });
    }

    // Event Listeners
    deptSelect.addEventListener('change', () => {
        currentDept = deptSelect.value;
        resetPagination();
        refreshDashboard();
    });

    attendeeTypeSelect.addEventListener('change', () => {
        currentType = attendeeTypeSelect.value;
        resetPagination();
        loadTableData();
    });

    // Debounced Search Input
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = searchInput.value.trim();
            resetPagination();
            loadTableData();
        }, 300); // 300ms debounce
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        resetPagination();
        loadTableData();
    });

    // Tabs filtering
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentEnteredFilter = tab.getAttribute('data-entered');
            resetPagination();
            loadTableData();
        });
    });

    // Pagination buttons
    prevPageBtn.addEventListener('click', () => {
        if (skip >= limit) {
            skip -= limit;
            loadTableData();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        skip += limit;
        loadTableData();
    });

    function resetPagination() {
        skip = 0;
    }

    // Load Distinct Departments
    async function loadDepartments() {
        try {
            const response = await secureFetch('/api/dashboard/departments');
            if (response.ok) {
                const data = await response.json();

                // Keep the default option
                deptSelect.innerHTML = '<option value="">All Departments</option>';

                data.departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    deptSelect.appendChild(option);
                });

                // If the logged in user is a dept head, they might be restricted to their own department in prod, 
                // but we let them select any department here as a general event dashboard.
            }
        } catch (e) {
            console.error("Failed to load departments:", e);
        }
    }

    // Refresh Stats and Table Data
    async function refreshDashboard() {
        await loadStats();
        await loadTableData();
    }

    // Load Stats and Update UI Cards
    async function loadStats() {
        try {
            let url = '/api/dashboard/stats';
            if (currentDept) {
                url += `?department=${encodeURIComponent(currentDept)}`;
            }

            const response = await secureFetch(url);
            if (response.ok) {
                const stats = await response.json();

                // Update Cards
                statTotalEntered.textContent = `${stats.total_entered} / ${stats.total_registered}`;
                statTotalPercent.textContent = `${stats.attendance_rate}% Checked-in`;
                totalProgressBar.style.width = `${stats.attendance_rate}%`;

                // Students count
                const studentRate = stats.students_registered > 0
                    ? Math.round((stats.students_entered / stats.students_registered * 100))
                    : 0;
                statStudentsEntered.textContent = `${stats.students_entered} / ${stats.students_registered}`;
                statStudentsPercent.textContent = `${studentRate}% checked-in`;
                studentsProgressBar.style.width = `${studentRate}%`;

                // Guardians count
                const guardianRate = stats.guardians_registered > 0
                    ? Math.round((stats.guardians_entered / stats.guardians_registered * 100))
                    : 0;
                statGuardiansEntered.textContent = `${stats.guardians_entered} / ${stats.guardians_registered}`;
                statGuardiansPercent.textContent = `${guardianRate}% checked-in`;
                guardiansProgressBar.style.width = `${guardianRate}%`;

                // Update tab badges
                countAll.textContent = stats.total_registered;
                countEntered.textContent = stats.total_entered;
                countNotEntered.textContent = stats.total_registered - stats.total_entered;
            }
        } catch (e) {
            console.error("Failed to load stats: ", e);
        }
    }

    // Query and Render Table Results
    async function loadTableData() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div class="spinner" style="margin-bottom: 0.5rem;"></div>
                    <div>Updating list...</div>
                </td>
            </tr>
        `;

        try {
            // Build Query Params
            let params = new URLSearchParams();
            params.append('skip', skip);
            params.append('limit', limit);

            if (currentDept) params.append('department', currentDept);
            if (currentType) params.append('type', currentType);
            if (currentSearch) params.append('search', currentSearch);

            if (currentEnteredFilter === 'true') {
                params.append('entered', 'true');
            } else if (currentEnteredFilter === 'false') {
                params.append('entered', 'false');
            }

            const response = await secureFetch(`/api/dashboard/users?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                renderTableRows(data.users);
                updatePaginationControls(data.total);
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
                            Failed to load database. Please try refreshing.
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
                        Connection error.
                    </td>
                </tr>
            `;
        }
    }

    // Render Table Row Elements
    function renderTableRows(users) {
        if (!users || users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        No attendees match the active filters.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');

            // Type Badge Column
            const typeBadge = user.type === 'student'
                ? '<span class="badge badge-student">Student</span>'
                : '<span class="badge badge-guardian">Guardian</span>';

            // Status Badge Column
            const statusBadge = user.entered
                ? '<span class="badge badge-entered">Checked In</span>'
                : '<span class="badge badge-not-entered">Not Checked In</span>';

            // Department Column (handles Guardians)
            const deptText = user.type === 'student'
                ? (user.department || '-')
                : `Guardian of ${user.linked_student_name || 'Student'}`;

            tr.innerHTML = `
                <td><strong>${user.register_number}</strong></td>
                <td><strong>${user.admission_number || '-'}</strong></td>
                <td>${user.name}</td>
                <td>${typeBadge}</td>
                <td>${deptText}</td>
                <td>${statusBadge}</td>
                <td>${formatDateTime(user.scanned_at)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Update Pagination Prev/Next buttons state
    function updatePaginationControls(totalFiltered) {
        const start = totalFiltered === 0 ? 0 : skip + 1;
        const end = Math.min(skip + limit, totalFiltered);

        paginationInfo.textContent = `Showing ${start} - ${end} of ${totalFiltered} attendees`;

        prevPageBtn.disabled = skip === 0;
        nextPageBtn.disabled = end >= totalFiltered;
    }

    // 9. Print Report Generation
    const printReportBtn = document.getElementById('print-report-btn');
    if (printReportBtn) {
        printReportBtn.addEventListener('click', async () => {
            const originalText = printReportBtn.innerHTML;
            printReportBtn.disabled = true;
            printReportBtn.innerHTML = '<span>⏳</span> Generating...';

            try {
                const params = new URLSearchParams();
                params.append('skip', '0');
                params.append('limit', '10000'); // Fetch all matching users

                if (currentDept) params.append('department', currentDept);
                if (currentType) params.append('type', currentType);
                if (currentSearch) params.append('search', currentSearch);

                if (currentEnteredFilter === 'true') {
                    params.append('entered', 'true');
                } else if (currentEnteredFilter === 'false') {
                    params.append('entered', 'false');
                }

                const response = await secureFetch(`/api/dashboard/users?${params.toString()}`);
                if (!response.ok) {
                    throw new Error("Failed to retrieve report data.");
                }

                const data = await response.json();
                const users = data.users || [];

                // Generate timestamp
                const downloadTime = new Date().toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'medium'
                });

                // Filter descriptions
                const deptDesc = currentDept || "All Departments";
                const typeDesc = currentType === 'student' ? 'Students Only' : (currentType === 'guardian' ? 'Guardians Only' : 'All Types (Students & Guardians)');
                const statusDesc = currentEnteredFilter === 'all' ? 'All Registered' : (currentEnteredFilter === 'true' ? 'Checked In Only' : 'Not Checked In Only');
                const searchDesc = currentSearch ? `"${currentSearch}"` : 'None';

                // Stats
                const totalCount = users.length;
                const enteredCount = users.filter(u => u.entered).length;
                const entryRate = totalCount > 0 ? ((enteredCount / totalCount) * 100).toFixed(1) : '0.0';

                // Open new tab/window for print layout
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>Attendance Report - Convocation 2026</title>
                        <style>
                            @media print {
                                @page {
                                    size: A4 portrait;
                                    margin: 15mm;
                                }
                                body {
                                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                                    color: #000;
                                    background: #fff;
                                    font-size: 9pt;
                                    line-height: 1.4;
                                }
                                .no-print {
                                    display: none !important;
                                }
                            }
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                                color: #333;
                                background: #fff;
                                margin: 2rem auto;
                                max-width: 900px;
                                padding: 0 1rem;
                            }
                            .header-container {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-start;
                                border-bottom: 2px solid #333;
                                padding-bottom: 1rem;
                                margin-bottom: 1.5rem;
                            }
                            .title-area h1 {
                                font-size: 1.6rem;
                                margin: 0 0 0.25rem 0;
                                color: #111;
                            }
                            .title-area p {
                                margin: 0;
                                color: #666;
                                font-size: 0.9rem;
                            }
                            .timestamp-area {
                                text-align: right;
                                font-size: 0.85rem;
                                color: #555;
                            }
                            .filters-card {
                                background: #f9f9f9;
                                border: 1px solid #e0e0e0;
                                border-radius: 6px;
                                padding: 1rem;
                                margin-bottom: 1.5rem;
                                font-size: 0.9rem;
                            }
                            .filters-card h3 {
                                margin: 0 0 0.5rem 0;
                                font-size: 1rem;
                                color: #222;
                            }
                            .filters-grid {
                                display: grid;
                                grid-template-columns: 1fr 1fr;
                                gap: 0.5rem 1.5rem;
                            }
                            .stat-summary {
                                display: flex;
                                gap: 2rem;
                                margin-bottom: 1.5rem;
                                border-top: 1px solid #eee;
                                border-bottom: 1px solid #eee;
                                padding: 0.75rem 0;
                            }
                            .stat-box {
                                display: flex;
                                flex-direction: column;
                            }
                            .stat-val {
                                font-size: 1.4rem;
                                font-weight: bold;
                                color: #111;
                            }
                            .stat-lbl {
                                font-size: 0.75rem;
                                text-transform: uppercase;
                                color: #666;
                                font-weight: 600;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 1rem;
                            }
                            th {
                                background-color: #f1f1f1;
                                color: #333;
                                text-align: left;
                                font-weight: 600;
                                font-size: 0.85rem;
                                text-transform: uppercase;
                                padding: 8px 10px;
                                border-bottom: 2px solid #ddd;
                            }
                            td {
                                padding: 8px 10px;
                                border-bottom: 1px solid #eee;
                                font-size: 0.9rem;
                            }
                            tr:nth-child(even) {
                                background-color: #fafafa;
                            }
                            .badge {
                                display: inline-block;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                            }
                            .badge-entered {
                                background-color: #e6f4ea;
                                color: #137333;
                            }
                            .badge-not-entered {
                                background-color: #fce8e6;
                                color: #c5221f;
                            }
                            .badge-student {
                                background-color: #e8f0fe;
                                color: #1a73e8;
                            }
                            .badge-guardian {
                                background-color: #f3e8ff;
                                color: #7c3aed;
                            }
                            .print-btn-container {
                                margin-bottom: 1.5rem;
                            }
                            .btn-print {
                                background-color: #2563eb;
                                color: #fff;
                                border: none;
                                padding: 0.6rem 1.2rem;
                                font-size: 0.95rem;
                                font-weight: 600;
                                border-radius: 6px;
                                cursor: pointer;
                            }
                            .btn-print:hover {
                                background-color: #1d4ed8;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="print-btn-container no-print">
                            <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
                        </div>
                        
                        <div class="header-container">
                            <div class="title-area">
                                <h1>Convocation 2026 - Attendance & Entry Report</h1>
                                <p>Program Entry Registration & Verification System</p>
                            </div>
                            <div class="timestamp-area">
                                <strong>Generated On:</strong><br>${downloadTime}
                            </div>
                        </div>

                        <div class="filters-card">
                            <h3>Report Filters Applied</h3>
                            <div class="filters-grid">
                                <div><strong>Department:</strong> ${deptDesc}</div>
                                <div><strong>Attendee Type:</strong> ${typeDesc}</div>
                                <div><strong>Entry Status Filter:</strong> ${statusDesc}</div>
                                <div><strong>Search Query:</strong> ${searchDesc}</div>
                            </div>
                        </div>

                        <div class="stat-summary">
                            <div class="stat-box">
                                <span class="stat-val">${totalCount}</span>
                                <span class="stat-lbl">Matching Records</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-val">${enteredCount}</span>
                                <span class="stat-lbl">Checked In</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-val">${entryRate}%</span>
                                <span class="stat-lbl">Attendance Rate</span>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 5%;">S.No</th>
                                    <th style="width: 15%;">Reg. Number</th>
                                    <th style="width: 12%;">Adm. Number</th>
                                    <th>Name</th>
                                    <th style="width: 12%;">Type</th>
                                    <th style="width: 25%;">Department</th>
                                    <th style="width: 15%;">Entry Status</th>
                                    <th style="width: 16%;">Scan Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.map((u, i) => {
                    const roleBadge = u.type === 'student'
                        ? '<span class="badge badge-student">Student</span>'
                        : '<span class="badge badge-guardian">Guardian</span>';
                    const entryBadge = u.entered
                        ? '<span class="badge badge-entered">Entered</span>'
                        : '<span class="badge badge-not-entered">Not Entered</span>';
                    const deptVal = u.type === 'student'
                        ? (u.department || '-')
                        : `Guardian of ${u.linked_student_name || 'Student'}`;

                    const scanTime = u.scanned_at
                        ? new Date(u.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(u.scanned_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        : '-';

                    return `
                                        <tr>
                                            <td>${i + 1}</td>
                                            <td><strong>${u.register_number}</strong></td>
                                            <td>${u.admission_number || '-'}</td>
                                            <td>${u.name}</td>
                                            <td>${roleBadge}</td>
                                            <td>${deptVal}</td>
                                            <td>${entryBadge}</td>
                                            <td>${scanTime}</td>
                                        </tr>
                                    `;
                }).join('')}
                            </tbody>
                        </table>
                        
                        <script>
                            window.onload = function() {
                                setTimeout(function() {
                                    window.print();
                                }, 500);
                            };
                        <\/script>
                    </body>
                    </html>
                `);
                printWindow.document.close();

            } catch (err) {
                console.error(err);
                Modal.show({
                    title: 'Report Generation Failed',
                    message: err.message || 'An error occurred while generating the attendance report.',
                    type: 'danger'
                });
            } finally {
                printReportBtn.disabled = false;
                printReportBtn.innerHTML = originalText;
            }
        });
    }
});
