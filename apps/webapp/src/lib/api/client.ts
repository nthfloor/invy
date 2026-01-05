import { browser } from '$app/environment';

const API_BASE_URL = browser
	? import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
	: 'http://localhost:3000/api/v1';

export class ApiError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

interface RequestOptions extends RequestInit {
	params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
	const { params, ...fetchOptions } = options;

	let url = `${API_BASE_URL}${endpoint}`;

	if (params) {
		const searchParams = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined) {
				searchParams.append(key, String(value));
			}
		});
		const queryString = searchParams.toString();
		if (queryString) {
			url += `?${queryString}`;
		}
	}

	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...fetchOptions.headers
	};

	const response = await fetch(url, {
		...fetchOptions,
		headers
	});

	if (!response.ok) {
		let message: string;
		try {
			const error = await response.json();
			message = error.message || response.statusText;
		} catch {
			message = response.statusText;
		}
		throw new ApiError(response.status, response.statusText, message);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json();
}

export const api = {
	get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
		request<T>(endpoint, { method: 'GET', params }),

	post: <T>(endpoint: string, body?: unknown) =>
		request<T>(endpoint, {
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		}),

	put: <T>(endpoint: string, body?: unknown) =>
		request<T>(endpoint, {
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined
		}),

	patch: <T>(endpoint: string, body?: unknown) =>
		request<T>(endpoint, {
			method: 'PATCH',
			body: body ? JSON.stringify(body) : undefined
		}),

	delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
};

// Typed API methods for each resource
export interface PaginatedResult<T> {
	data: T[];
	meta: {
		total: number;
		page: number;
		perPage: number;
		totalPages: number;
	};
}

export interface Company {
	id: string;
	name: string;
	email: string;
	phone?: string;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
	settings?: Record<string, unknown>;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface Client {
	id: string;
	companyId: string;
	name: string;
	email: string;
	phone?: string;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
	externalId?: string;
	notes?: string;
	isActive: boolean;
	createdBy?: string;
	updatedBy?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Product {
	id: string;
	companyId: string;
	name: string;
	description?: string;
	unitPrice: number;
	currency: string;
	taxRate?: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface Invoice {
	id: string;
	companyId: string;
	clientId: string;
	invoiceNumber: string;
	status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
	issueDate: string;
	dueDate: string;
	subtotal: number;
	taxAmount: number;
	total: number;
	currency: string;
	notes?: string;
	lineItems: InvoiceLineItem[];
	createdAt: string;
	updatedAt: string;
}

export interface InvoiceLineItem {
	id: string;
	productId?: string;
	description: string;
	quantity: number;
	unitPrice: number;
	taxRate?: number;
	total: number;
}

export interface Payment {
	id: string;
	companyId: string;
	invoiceId: string;
	amount: number;
	currency: string;
	paymentDate: string;
	paymentMethod: string;
	reference?: string;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

// Resource-specific API methods
export const companiesApi = {
	list: (params?: { page?: number; perPage?: number; search?: string }) =>
		api.get<PaginatedResult<Company>>('/companies', params),

	get: (id: string) => api.get<Company>(`/companies/${id}`),

	create: (data: Partial<Company>) => api.post<Company>('/companies', data),

	update: (id: string, data: Partial<Company>) => api.patch<Company>(`/companies/${id}`, data),

	delete: (id: string) => api.delete<void>(`/companies/${id}`)
};

export const clientsApi = {
	list: (companyId: string, params?: { page?: number; perPage?: number; search?: string }) =>
		api.get<PaginatedResult<Client>>(`/companies/${companyId}/clients`, params),

	get: (companyId: string, id: string) => api.get<Client>(`/companies/${companyId}/clients/${id}`),

	create: (companyId: string, data: Partial<Client>) =>
		api.post<Client>(`/companies/${companyId}/clients`, data),

	update: (companyId: string, id: string, data: Partial<Client>) =>
		api.patch<Client>(`/companies/${companyId}/clients/${id}`, data),

	delete: (companyId: string, id: string) =>
		api.delete<void>(`/companies/${companyId}/clients/${id}`)
};

export const productsApi = {
	list: (companyId: string, params?: { page?: number; perPage?: number; search?: string }) =>
		api.get<PaginatedResult<Product>>(`/companies/${companyId}/products`, params),

	get: (companyId: string, id: string) =>
		api.get<Product>(`/companies/${companyId}/products/${id}`),

	create: (companyId: string, data: Partial<Product>) =>
		api.post<Product>(`/companies/${companyId}/products`, data),

	update: (companyId: string, id: string, data: Partial<Product>) =>
		api.patch<Product>(`/companies/${companyId}/products/${id}`, data),

	delete: (companyId: string, id: string) =>
		api.delete<void>(`/companies/${companyId}/products/${id}`)
};

export const invoicesApi = {
	list: (
		companyId: string,
		params?: { page?: number; perPage?: number; status?: string; clientId?: string }
	) => api.get<PaginatedResult<Invoice>>(`/companies/${companyId}/invoices`, params),

	get: (companyId: string, id: string) =>
		api.get<Invoice>(`/companies/${companyId}/invoices/${id}`),

	create: (companyId: string, data: Partial<Invoice>) =>
		api.post<Invoice>(`/companies/${companyId}/invoices`, data),

	update: (companyId: string, id: string, data: Partial<Invoice>) =>
		api.patch<Invoice>(`/companies/${companyId}/invoices/${id}`, data),

	send: (companyId: string, id: string) =>
		api.post<Invoice>(`/companies/${companyId}/invoices/${id}/send`),

	delete: (companyId: string, id: string) =>
		api.delete<void>(`/companies/${companyId}/invoices/${id}`)
};

export const paymentsApi = {
	list: (companyId: string, params?: { page?: number; perPage?: number; invoiceId?: string }) =>
		api.get<PaginatedResult<Payment>>(`/companies/${companyId}/payments`, params),

	get: (companyId: string, id: string) =>
		api.get<Payment>(`/companies/${companyId}/payments/${id}`),

	create: (companyId: string, data: Partial<Payment>) =>
		api.post<Payment>(`/companies/${companyId}/payments`, data),

	delete: (companyId: string, id: string) =>
		api.delete<void>(`/companies/${companyId}/payments/${id}`)
};
