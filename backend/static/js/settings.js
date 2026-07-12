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

    // Initial load
    loadStaff();
});
