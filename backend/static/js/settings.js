document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification & gate authorization (Admin Only)
    const currentUser = await checkAuthSession(['admin']);
    if (!currentUser) return;

    const staffTableBody = document.getElementById('staff-table-body');
    const addStaffForm = document.getElementById('add-staff-form');

    // Load active staff accounts
    async function loadStaff() {
        try {
            const response = await secureFetch('/api/admin/staff');
            if (response.ok) {
                const staffList = await response.json();
                renderStaffTable(staffList);
            } else {
                console.error("Failed to load staff list.");
            }
        } catch (e) {
            console.error("Error fetching staff list:", e);
        }
    }

    // Render staff table
    function renderStaffTable(staffList) {
        staffTableBody.innerHTML = '';

        if (staffList.length === 0) {
            staffTableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No staff accounts registered.</td>
                </tr>
            `;
            return;
        }

        staffList.forEach(staff => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.style.transition = 'background-color 0.2s';

            // Highlight current user
            const isSelf = staff.username === currentUser.username;
            const selfBadge = isSelf ? ' <span class="logo-badge" style="background: var(--success-light); color: var(--success); font-size: 0.75rem; padding: 0.1rem 0.4rem; font-weight: 600;">YOU</span>' : '';

            // Pretty role badge
            let roleBadgeClass = '';
            let roleLabel = staff.role.replace('_', ' ').toUpperCase();
            if (staff.role === 'admin') {
                roleBadgeClass = 'background: rgba(239, 68, 68, 0.15); color: #f87171;';
            } else if (staff.role === 'dept_head') {
                roleBadgeClass = 'background: rgba(139, 92, 246, 0.15); color: #a78bfa;';
            } else {
                roleBadgeClass = 'background: rgba(59, 130, 246, 0.15); color: #60a5fa;';
            }

            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-weight: 500; color: var(--text-primary);">${staff.username}${selfBadge}</td>
                <td style="padding: 1rem 0.5rem;">
                    <span class="logo-badge" style="${roleBadgeClass} font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-weight: 600;">
                        ${roleLabel}
                    </span>
                </td>
                <td style="padding: 1rem 0.5rem; text-align: right;">
                    ${isSelf ? `
                        <button class="btn btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; cursor: not-allowed; opacity: 0.5;" disabled>Delete</button>
                    ` : `
                        <button class="btn btn-danger delete-staff-btn" data-id="${staff.id}" data-username="${staff.username}" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">Delete</button>
                    `}
                </td>
            `;
            staffTableBody.appendChild(tr);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-staff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const staffId = btn.getAttribute('data-id');
                const username = btn.getAttribute('data-username');
                confirmDeleteStaff(staffId, username);
            });
        });
    }

    // Confirmation logic for deletion
    function confirmDeleteStaff(id, username) {
        Modal.show({
            title: 'Delete Staff Account',
            message: `Are you sure you want to permanently delete the staff account <strong>${username}</strong>? This action cannot be undone.`,
            type: 'warning',
            showCancel: true,
            onConfirm: async () => {
                try {
                    const response = await secureFetch(`/api/admin/staff/${id}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        Modal.show({
                            title: 'Success',
                            message: `Staff account <strong>${username}</strong> has been deleted successfully.`,
                            type: 'success'
                        });
                        loadStaff();
                    } else {
                        const err = await response.json();
                        Modal.show({
                            title: 'Error',
                            message: err.detail || 'Failed to delete the staff account.',
                            type: 'danger'
                        });
                    }
                } catch (e) {
                    console.error(e);
                    Modal.show({
                        title: 'Error',
                        message: 'A network error occurred. Please try again.',
                        type: 'danger'
                    });
                }
            }
        });
    }

    // Handle Create Staff form submission
    addStaffForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const roleInput = document.getElementById('role');

        const payload = {
            username: usernameInput.value.trim(),
            password: passwordInput.value,
            role: roleInput.value
        };

        if (payload.password.length < 6) {
            Modal.show({
                title: 'Invalid Password',
                message: 'Password must be at least 6 characters long.',
                type: 'danger'
            });
            return;
        }

        try {
            const response = await secureFetch('/api/admin/staff', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                Modal.show({
                    title: 'Account Created',
                    message: `Staff account <strong>${payload.username}</strong> has been created successfully.`,
                    type: 'success'
                });
                usernameInput.value = '';
                passwordInput.value = '';
                roleInput.value = 'security';
                loadStaff();
            } else {
                const err = await response.json();
                Modal.show({
                    title: 'Creation Failed',
                    message: err.detail || 'Failed to create staff account.',
                    type: 'danger'
                });
            }
        } catch (e) {
            console.error(e);
            Modal.show({
                title: 'Error',
                message: 'A network error occurred. Please try again.',
                type: 'danger'
            });
        }
    });

    // --- Student & Guest Management Section ---
    const studentModal = document.getElementById('student-modal');
    const studentForm = document.getElementById('student-form');
    const studentIdInput = document.getElementById('student-id');
    const studentNameInput = document.getElementById('student-name');
    const studentRegisterInput = document.getElementById('student-register');
    const studentAdmissionInput = document.getElementById('student-admission');
    const studentDeptSelect = document.getElementById('student-department');
    const studentGuest1Input = document.getElementById('student-guest1');
    const studentGuest2Input = document.getElementById('student-guest2');
    
    const addStudentBtn = document.getElementById('add-student-btn');
    const closeStudentModalBtn = document.getElementById('close-student-modal-btn');
    const cancelStudentModalBtn = document.getElementById('cancel-student-modal-btn');
    
    const studentSearchInput = document.getElementById('student-search-input');
    const studentSearchBtn = document.getElementById('student-search-btn');
    const studentTableBody = document.getElementById('student-table-body');
    
    let lastSearchQuery = '';

    // Load available departments for the dropdown
    async function loadDropdownDepartments() {
        try {
            const response = await secureFetch('/api/dashboard/departments');
            if (response.ok) {
                const data = await response.json();
                const depts = data.departments || [];
                
                // Clear and add placeholder
                studentDeptSelect.innerHTML = '<option value="" disabled selected>Select Department/Course</option>';
                depts.forEach(dept => {
                    const opt = document.createElement('option');
                    opt.value = dept;
                    opt.textContent = dept;
                    studentDeptSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Error loading dropdown departments:", e);
        }
    }

    function openModal(title, isEdit = false) {
        document.getElementById('student-modal-title').textContent = title;
        studentModal.style.display = 'flex';
        // If editing, allow changing the register number but note it changes guest credentials
        if (isEdit) {
            studentRegisterInput.placeholder = "e.g. REG12345 (Modifying this updates guest IDs)";
        } else {
            studentRegisterInput.placeholder = "e.g. REG12345";
        }
    }

    function closeModal() {
        studentModal.style.display = 'none';
        studentForm.reset();
        studentIdInput.value = '';
    }

    // Event listeners for modal toggle
    addStudentBtn.addEventListener('click', () => {
        studentForm.reset();
        studentIdInput.value = '';
        openModal("Add Student", false);
    });

    closeStudentModalBtn.addEventListener('click', closeModal);
    cancelStudentModalBtn.addEventListener('click', closeModal);
    
    // Close modal on clicking overlay
    studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) {
            closeModal();
        }
    });

    // Search students function
    async function searchStudents(query) {
        lastSearchQuery = query;
        studentTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Searching...</td>
            </tr>
        `;
        
        try {
            const response = await secureFetch(`/api/admin/students?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const students = await response.json();
                renderStudentTable(students);
            } else {
                studentTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger);">Failed to fetch search results.</td>
                    </tr>
                `;
            }
        } catch (e) {
            console.error(e);
            studentTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger);">A network error occurred.</td>
                </tr>
            `;
        }
    }

    function renderStudentTable(students) {
        studentTableBody.innerHTML = '';
        if (students.length === 0) {
            studentTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No matching students found.</td>
                </tr>
            `;
            return;
        }

        students.forEach(s => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.style.transition = 'background-color 0.2s';
            
            // Format guest description
            let guestDesc = '';
            if (s.guest1_name && s.guest2_name) {
                guestDesc = `${s.guest1_name}, ${s.guest2_name}`;
            } else if (s.guest1_name) {
                guestDesc = s.guest1_name;
            } else if (s.guest2_name) {
                guestDesc = s.guest2_name;
            } else {
                guestDesc = '<span style="color: var(--text-muted); font-style: italic;">No guests</span>';
            }

            tr.innerHTML = `
                <td style="padding: 1rem 0.5rem; font-weight: 600; color: var(--text-primary);">${s.register_number}</td>
                <td style="padding: 1rem 0.5rem; font-weight: 500;">${s.name}</td>
                <td style="padding: 1rem 0.5rem;">${s.department || '-'}</td>
                <td style="padding: 1rem 0.5rem; font-size: 0.9rem;">${guestDesc}</td>
                <td style="padding: 1rem 0.5rem; text-align: right;">
                    <button class="btn btn-primary edit-student-btn" data-id="${s.id}" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; background: var(--accent); border-color: var(--accent);">Edit</button>
                </td>
            `;

            // Bind click to edit button
            tr.querySelector('.edit-student-btn').addEventListener('click', () => {
                studentIdInput.value = s.id;
                studentNameInput.value = s.name;
                studentRegisterInput.value = s.register_number;
                studentAdmissionInput.value = s.admission_number || '';
                studentDeptSelect.value = s.department || '';
                studentGuest1Input.value = s.guest1_name || '';
                studentGuest2Input.value = s.guest2_name || '';
                openModal("Edit Student", true);
            });

            studentTableBody.appendChild(tr);
        });
    }

    studentSearchBtn.addEventListener('click', () => {
        searchStudents(studentSearchInput.value.trim());
    });

    studentSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchStudents(studentSearchInput.value.trim());
        }
    });

    // Form submission (Add/Edit)
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            name: studentNameInput.value.trim(),
            register_number: studentRegisterInput.value.trim(),
            admission_number: studentAdmissionInput.value.trim() || null,
            department: studentDeptSelect.value,
            guest1_name: studentGuest1Input.value.trim() || null,
            guest2_name: studentGuest2Input.value.trim() || null
        };

        const studentId = studentIdInput.value;
        const isEdit = !!studentId;
        const url = isEdit ? `/api/admin/students/${studentId}` : '/api/admin/students';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await secureFetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                Modal.show({
                    title: 'Success',
                    message: isEdit ? `Student details have been updated successfully.` : `Student <strong>${payload.name}</strong> created successfully.`,
                    type: 'success'
                });
                closeModal();
                // Refresh table results
                searchStudents(lastSearchQuery);
            } else {
                const err = await response.json();
                Modal.show({
                    title: 'Operation Failed',
                    message: err.detail || 'Failed to save student details.',
                    type: 'danger'
                });
            }
        } catch (e) {
            console.error(e);
            Modal.show({
                title: 'Error',
                message: 'A network error occurred. Please try again.',
                type: 'danger'
            });
        }
    });

    // Initial load
    loadStaff();
    loadDropdownDepartments();
});
