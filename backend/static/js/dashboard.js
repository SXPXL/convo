/**
 * Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification
    const currentStaff = await checkAuthSession(['dept_head', 'admin']);
    if (!currentStaff) return;

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

    // Initialize Dashboard
    await loadDepartments();
    await refreshDashboard();

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
                        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger);">
                            Failed to load database. Please try refreshing.
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger);">
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
                    <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        No attendees match the active filters.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');

            // Photo Column (thumbnail)
            const photoUrl = user.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop';
            const photoTd = `<td><img src="${photoUrl}" alt="Photo" class="thumbnail"></td>`;

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
                ${photoTd}
                <td><strong>${user.admission_number}</strong></td>
                <td>${user.name}</td>
                <td>${typeBadge}</td>
                <td><span style="font-family: monospace; font-weight: 600; color: var(--accent);">${user.seat_number || '-'}</span></td>
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
});
