// User authentication and menu functionality
import { API_URL } from './config.js';
import mobileMenu from './mobile-menu.js';

/**
 * Load user avatar based on owner group
 * Super admins get default icon, owner users get their owner's logo
 */
export async function loadUserAvatar() {
    try {
        // Get JWT token from Supabase session
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);
        
        if (!sessionData) {
            return; // Not logged in, keep default icon
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;

        if (!token) {
            return; // No token, keep default icon
        }

        // Fetch user permissions to get owner group info
        const response = await fetch(`${API_URL}/api/permissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Token might be expired or invalid - this is not an error, just means user needs to re-login
            if (response.status === 401) {
                console.log('🔒 Session expired or invalid - using default avatar');
            } else {
                console.warn('Could not fetch user permissions:', response.status);
            }
            return;
        }

        const data = await response.json();
        const userAvatar = document.querySelector('.user-avatar');
        
        if (!userAvatar) return;

        // Check if user is super admin or has owner groups
        const isSuperAdmin = data.is_super_admin;
        const ownerGroups = data.owner_groups || [];

        if (isSuperAdmin) {
            // Super admin: keep the default user icon (already in HTML)
            console.log('Super admin: using default user icon');
            return;
        }

        // For ALL users with owner groups: use the first owner group's logo
        if (ownerGroups.length > 0) {
            const primaryOwner = ownerGroups[0];
            
            // Fetch accessible owners to get logo_url
            const ownerResponse = await fetch(`${API_URL}/api/permissions/accessible-owners`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (ownerResponse.ok) {
                const owners = await ownerResponse.json();
                const ownerData = owners.find(o => o.owner_id === primaryOwner.owner_id);
                
                if (ownerData && ownerData.logo_url) {
                    // Replace SVG icon with owner logo image
                    userAvatar.innerHTML = `<img src="${ownerData.logo_url}" alt="${ownerData.owner_name}" class="owner-logo" />`;
                    console.log(`Loaded owner logo for: ${ownerData.owner_name}`);
                }
            }
        }
    } catch (error) {
        console.error('Error loading user avatar:', error);
        // Keep default icon on error
    }
}

/**
 * Initialize user menu dropdown and sign-out functionality
 */
export async function initializeUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    if (!userMenuBtn || !userMenuDropdown) return;

    // Load user avatar/owner logo
    await loadUserAvatar();

    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userMenuDropdown.classList.contains('open');

        if (isOpen) {
            closeUserMenuDropdown();
        } else {
            openUserMenuDropdown();
        }
    });

    // Sign out functionality
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                console.log('👋 Starting sign out process...');
                
                // Clear ALL Supabase auth keys from localStorage
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('sb-')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    console.log('🗑️ Removed localStorage key:', key);
                });

                // Clear session storage
                sessionStorage.clear();
                console.log('🗑️ Cleared sessionStorage');

                // Close dropdown
                closeUserMenuDropdown();

                // Hide user menu and update mobile menu
                await updateUserMenuVisibility();

                // Redirect to login page with logout message (same as React admin app)
                console.log('👋 User signed out successfully, redirecting to login page');
                window.location.href = '/app/login?logout=true';

            } catch (error) {
                console.error('❌ Error signing out:', error);
                // Even if there's an error, redirect to login page
                window.location.href = '/app/login?logout=true';
            }
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
            closeUserMenuDropdown();
        }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserMenuDropdown();
        }
    });
}

function openUserMenuDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.classList.add('open');
        userMenuDropdown.classList.add('open');
    }
}

function closeUserMenuDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');

    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.classList.remove('open');
        userMenuDropdown.classList.remove('open');
    }
}

/**
 * Check if user is authenticated and show/hide user menu accordingly
 */
export async function updateUserMenuVisibility() {
    const userMenuSection = document.getElementById('userMenuSection');
    const userEmailElement = document.getElementById('userEmail');

    try {
        // Check for Supabase JWT token
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);

        if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;
            const user = session?.user;

            if (token && user) {
                // User is authenticated, show user menu and populate email
                if (userMenuSection) {
                    userMenuSection.style.display = 'flex';
                    console.log('👤 User menu shown for authenticated user');
                }
                if (userEmailElement && user.email) {
                    userEmailElement.textContent = user.email;
                }
                
                // Update mobile menu visibility
                await mobileMenu.updateVisibility();
                return;
            }
        }

        // User is not authenticated, hide user menu
        if (userMenuSection) {
            userMenuSection.style.display = 'none';
            console.log('👤 User menu hidden for unauthenticated user');
        }
        
        // Update mobile menu visibility
        await mobileMenu.updateVisibility();
    } catch (error) {
        console.error('Error checking authentication for user menu:', error);
        if (userMenuSection) userMenuSection.style.display = 'none';
    }
}

