import { writable, derived } from 'svelte/store';

// Mock user type - will be replaced with Cognito user when auth is integrated
export interface User {
	id: string;
	email: string;
	name: string;
	groups: string[]; // Cognito groups for RBAC
	companyId?: string; // Current company context
}

// Mock auth state - Cognito-ready structure
function createAuthStore() {
	const { subscribe, set, update } = writable<{
		user: User | null;
		loading: boolean;
		initialized: boolean;
	}>({
		user: null,
		loading: false,
		initialized: false
	});

	return {
		subscribe,

		// Initialize auth - will check Cognito session when integrated
		init: async () => {
			update((state) => ({ ...state, loading: true }));

			// Mock: Auto-login for development
			// TODO: Replace with Cognito session check
			const mockUser: User = {
				id: 'dev-user-1',
				email: 'dev@example.com',
				name: 'Developer',
				groups: ['admin'],
				companyId: undefined
			};

			set({
				user: mockUser,
				loading: false,
				initialized: true
			});
		},

		// Login - will use Cognito hosted UI when integrated
		login: async () => {
			// TODO: Redirect to Cognito hosted UI
			console.log('Login would redirect to Cognito hosted UI');
		},

		// Logout - will clear Cognito session when integrated
		logout: async () => {
			set({
				user: null,
				loading: false,
				initialized: true
			});
			// TODO: Clear Cognito session and redirect
		},

		// Set current company context
		setCompany: (companyId: string) => {
			update((state) => ({
				...state,
				user: state.user ? { ...state.user, companyId } : null
			}));
		},

		// Check if user has a specific role
		hasRole: (role: string) => {
			let hasIt = false;
			subscribe((state) => {
				hasIt = state.user?.groups.includes(role) ?? false;
			})();
			return hasIt;
		}
	};
}

export const auth = createAuthStore();

// Derived stores for convenience
export const user = derived(auth, ($auth) => $auth.user);
export const isAuthenticated = derived(auth, ($auth) => $auth.user !== null);
export const isLoading = derived(auth, ($auth) => $auth.loading);
export const currentCompanyId = derived(auth, ($auth) => $auth.user?.companyId);
