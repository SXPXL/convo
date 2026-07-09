/**
 * Login Script
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            Modal.show({
                title: 'Validation Error',
                message: 'Please fill in both fields.',
                type: 'danger'
            });
            return;
        }

        // Show spinner state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';

        try {
            const response = await secureFetch('/api/auth/login', {
                method: 'POST',
                body: { username, password }
            });

            const data = await response.json();

            if (response.ok) {
                // Successfully authenticated, redirect based on role
                if (data.role === 'security') {
                    window.location.href = '/scanner';
                } else if (data.role === 'dept_head' || data.role === 'admin') {
                    window.location.href = '/dashboard';
                } else {
                    Modal.show({
                        title: 'Unknown Role',
                        message: `Account role '${data.role}' is not recognized.`,
                        type: 'danger'
                    });
                    resetButtonState();
                }
            } else {
                // Display error message in custom modal
                Modal.show({
                    title: 'Authentication Failed',
                    message: data.detail || 'Incorrect username or password. Please try again.',
                    type: 'danger'
                });
                resetButtonState();
            }
        } catch (error) {
            Modal.show({
                title: 'Server Connection Error',
                message: 'Unable to reach the server. Please check your internet connection and try again.',
                type: 'danger'
            });
            resetButtonState();
        }
    });

    function resetButtonState() {
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
    }
});
