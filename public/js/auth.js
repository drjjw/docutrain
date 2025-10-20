// Authentication state management using Supabase Auth
import { API_URL } from './config.js';

// Supabase client configuration (browser-only, using anon key)
let supabaseClient = null;

// Initialize Supabase client (lazy-loaded from CDN)
async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    // Load Supabase client from CDN if not already loaded
    if (!window.supabase) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
            script.onload = resolve;
        });
    }

    // Get Supabase credentials from meta tags or environment
    // For security, these should be injected by the server
    const supabaseUrl = 'https://mlxctdgnojvkgfqldaob.supabase.co';
    const supabaseAnonKey = window.SUPABASE_ANON_KEY || await fetchSupabaseConfig();

    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
}

// Fetch Supabase config from server (safer than hardcoding)
async function fetchSupabaseConfig() {
    try {
        const response = await fetch(`${API_URL}/api/config/supabase`);
        if (response.ok) {
            const data = await response.json();
            return data.anonKey;
        }
    } catch (error) {
        console.warn('Failed to fetch Supabase config, using default');
    }
    // Fallback - in production, this should come from server
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1seGN0ZGdub2p2a2dmcWxkYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMDE1NzcsImV4cCI6MjA0Mzg3NzU3N30.BhWrLHy_v_aE3nfAV8QLYuWHY9mSHPuGmTJRN2z1234'; // This should be replaced
}

// Authentication state
let currentUser = null;
let authToken = null;

// Get current user
export function getCurrentUser() {
    return currentUser;
}

// Get auth token for API calls
export function getAuthToken() {
    return authToken;
}

// Check if user is authenticated
export function isAuthenticated() {
    return currentUser !== null && authToken !== null;
}

// Sign up with email and password
export async function signUp(email, password, metadata = {}) {
    try {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, metadata })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Signup failed');
        }

        // Store session
        if (data.session) {
            currentUser = data.user;
            authToken = data.session.access_token;
            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Notify listeners
            notifyAuthStateChange();
        }

        return { success: true, user: data.user };

    } catch (error) {
        console.error('Signup error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in with email and password
export async function signIn(email, password) {
    try {
        const response = await fetch(`${API_URL}/api/auth/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Sign in failed');
        }

        // Store session
        if (data.session) {
            currentUser = data.user;
            authToken = data.session.access_token;
            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Notify listeners
            notifyAuthStateChange();
        }

        return { success: true, user: data.user };

    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
export async function signOut() {
    try {
        if (authToken) {
            await fetch(`${API_URL}/api/auth/signout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        }
    } catch (error) {
        console.error('Sign out error:', error);
    } finally {
        // Clear local state regardless of API call result
        currentUser = null;
        authToken = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        
        // Notify listeners
        notifyAuthStateChange();
    }
}

// Restore session from localStorage
export async function restoreSession() {
    try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            // Verify token is still valid
            const response = await fetch(`${API_URL}/api/auth/session`, {
                headers: {
                    'Authorization': `Bearer ${storedToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                authToken = storedToken;
                
                console.log('✓ Session restored:', currentUser.email);
                notifyAuthStateChange();
                return true;
            } else {
                // Token is invalid, clear storage
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
            }
        }
    } catch (error) {
        console.error('Session restore error:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    }
    
    return false;
}

// Auth state change listeners
const authListeners = [];

export function onAuthStateChange(callback) {
    authListeners.push(callback);
    // Immediately call with current state
    callback(currentUser);
    
    // Return unsubscribe function
    return () => {
        const index = authListeners.indexOf(callback);
        if (index > -1) {
            authListeners.splice(index, 1);
        }
    };
}

function notifyAuthStateChange() {
    authListeners.forEach(callback => callback(currentUser));
}

// Show auth modal
export function showAuthModal(mode = 'signin') {
    const modal = document.getElementById('authModal');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    
    if (mode === 'signin') {
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
    
    modal.style.display = 'flex';
}

// Hide auth modal
export function hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
    
    // Clear form errors
    document.querySelectorAll('.auth-error').forEach(el => el.textContent = '');
}

// Initialize auth UI
export function initAuthUI() {
    // Setup modal event listeners
    const modal = document.getElementById('authModal');
    const closeBtn = modal?.querySelector('.close-modal');
    const switchToSignup = document.getElementById('switchToSignup');
    const switchToSignin = document.getElementById('switchToSignin');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', hideAuthModal);
    }
    
    if (switchToSignup) {
        switchToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('signup');
        });
    }
    
    if (switchToSignin) {
        switchToSignin.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('signin');
        });
    }
    
    // Close modal on outside click
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideAuthModal();
        }
    });
    
    // Setup signin form
    const signinFormEl = document.getElementById('signinFormElement');
    signinFormEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        const errorEl = document.getElementById('signinError');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        errorEl.textContent = '';
        
        const result = await signIn(email, password);
        
        if (result.success) {
            hideAuthModal();
            // Reset form
            signinFormEl.reset();
        } else {
            errorEl.textContent = result.error;
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    });
    
    // Setup signup form
    const signupFormEl = document.getElementById('signupFormElement');
    signupFormEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        const errorEl = document.getElementById('signupError');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        errorEl.textContent = '';
        
        // Validate passwords match
        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
        
        const result = await signUp(email, password);
        
        if (result.success) {
            hideAuthModal();
            // Reset form
            signupFormEl.reset();
            
            // Show success message
            alert('Account created successfully! Please check your email to verify your account.');
        } else {
            errorEl.textContent = result.error;
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
    });
    
    // Setup user profile button
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    userProfileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }
    });
    
    logoutBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut();
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }
    });
    
    // Update UI based on auth state
    onAuthStateChange((user) => {
        const authButton = document.getElementById('authButton');
        const userProfile = document.getElementById('userProfile');
        const userEmail = document.getElementById('userEmail');
        
        if (user) {
            // User is signed in
            if (authButton) authButton.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            if (userEmail) userEmail.textContent = user.email;
        } else {
            // User is signed out
            if (authButton) authButton.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
        }
    });
    
    // Setup auth button
    const authButton = document.getElementById('authButton');
    authButton?.addEventListener('click', () => {
        showAuthModal('signin');
    });
    
    console.log('✓ Auth UI initialized');
}
