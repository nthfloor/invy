import { browser } from '$app/environment';

const API_BASE_URL = browser
	? import.meta.env.VITE_API_URL || 'http://localhost:3010/api/v1'
	: 'http://localhost:3010/api/v1';

const API_TOKEN = browser ? import.meta.env.VITE_API_TOKEN : '';

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
		...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
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

	delete: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
		request<T>(endpoint, { method: 'DELETE', params })
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

export interface Address {
	line1?: string;
	line2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
}

export interface CompanySettings {
	invoicePrefix?: string;
	quotePrefix?: string;
	estimatePrefix?: string;
	paymentTermsDays?: number;
	quoteValidityDays?: number;
}

export interface CompanyBranding {
	logoUrl?: string;
	primaryColor?: string;
	secondaryColor?: string;
}

export interface Company {
	id: string;
	name: string;
	email: string;
	phone?: string;
	taxId?: string;
	taxNumber?: string;
	registrationNumber?: string;
	currency: string;
	address?: Address;
	settings?: CompanySettings;
	branding?: CompanyBranding;
	isActive: boolean;
	createdOn: string;
	updatedOn: string;
}

export interface CreateCompanyRequest {
	name: string;
	email: string;
	phone?: string;
	taxId?: string;
	taxNumber?: string;
	registrationNumber?: string;
	currency?: string;
	address?: Address;
	settings?: CompanySettings;
	branding?: CompanyBranding;
}

export interface Client {
	id: string;
	companyId: string;
	name: string;
	email: string;
	phone?: string;
	address?: Address;
	externalId?: string;
	vatNumber?: string;
	taxNumber?: string;
	registrationNumber?: string;
	notes?: string;
	isActive: boolean;
	createdBy?: string;
	updatedBy?: string;
	createdOn: string;
	updatedOn: string;
}

export interface Product {
	id: string;
	companyId: string;
	name: string;
	description?: string;
	unitPrice: number;
	taxId?: string;
	taxRate?: number;
	sku?: string;
	isActive: boolean;
	createdOn: string;
	updatedOn: string;
}

export interface InvoiceItem {
	id: string;
	invoiceId: string;
	productId?: string;
	description: string;
	quantity: number;
	unitPrice: number;
	taxRate: number;
	lineTotal: number;
	lineTax: number;
	sortOrder: number;
}

export interface Invoice {
	id: string;
	companyId: string;
	clientId: string;
	invoiceNumber: string;
	status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
	issueDate: string;
	dueDate: string;
	subtotal: number;
	taxTotal: number;
	total: number;
	amountPaid: number;
	balance: number;
	notes?: string;
	terms?: string;
	cancelReason?: string;
	items?: InvoiceItem[];
	client?: Client;
	createdOn: string;
	updatedOn: string;
}

export interface Payment {
	id: string;
	companyId: string;
	clientId: string;
	invoiceId: string;
	paymentNumber: string;
	amount: number;
	paymentDate: string;
	paymentMethod: string;
	reference?: string;
	notes?: string;
	status: 'pending' | 'completed' | 'failed' | 'refunded';
	createdOn: string;
	updatedOn: string;
}

export interface CreditNote {
	id: string;
	companyId: string;
	clientId: string;
	invoiceId: string;
	creditNoteNumber: string;
	status: 'draft' | 'issued' | 'applied' | 'voided';
	issueDate: string;
	reason: string;
	notes?: string;
	subtotal: number;
	taxTotal: number;
	total: number;
	allocatedAmount: number;
	amountApplied: number;
	balance: number;
	voidReason?: string;
	createdOn: string;
	updatedOn: string;
}

// Resource-specific API methods

// Companies - flat routes
export const companiesApi = {
	list: (params?: { page?: number; perPage?: number }) =>
		api.get<PaginatedResult<Company>>('/companies', params),

	get: (id: string) => api.get<Company>(`/companies/${id}`),

	create: (data: CreateCompanyRequest) => api.post<Company>('/companies', data),

	update: (id: string, data: Partial<CreateCompanyRequest>) => api.put<Company>(`/companies/${id}`, data),

	delete: (id: string) => api.delete<void>(`/companies/${id}`)
};

// Clients - flat routes with companyId as query param
export const clientsApi = {
	list: (companyId: string, params?: { page?: number; perPage?: number; search?: string }) =>
		api.get<PaginatedResult<Client>>('/clients', { companyId, ...params }),

	get: (id: string, companyId: string) => api.get<Client>(`/clients/${id}`, { companyId }),

	getByExternalId: (externalId: string, companyId: string) =>
		api.get<Client>(`/clients/external/${externalId}`, { companyId }),

	create: (companyId: string, data: Partial<Client>) =>
		api.post<Client>('/clients', { companyId, ...data }),

	update: (id: string, companyId: string, data: Partial<Client>) =>
		api.put<Client>(`/clients/${id}?companyId=${companyId}`, data),

	delete: (id: string, companyId: string) => api.delete<void>(`/clients/${id}`, { companyId })
};

// Products - flat routes with companyId as query param
export const productsApi = {
	list: (companyId: string, params?: { page?: number; perPage?: number; search?: string }) =>
		api.get<PaginatedResult<Product>>('/products', { companyId, ...params }),

	get: (id: string, companyId: string) => api.get<Product>(`/products/${id}`, { companyId }),

	create: (data: { companyId: string } & Partial<Product>) => api.post<Product>('/products', data),

	update: (id: string, companyId: string, data: Partial<Product>) =>
		api.put<Product>(`/products/${id}?companyId=${companyId}`, data),

	delete: (id: string, companyId: string) => api.delete<void>(`/products/${id}`, { companyId })
};

// Invoices - flat routes with companyId as query param
export const invoicesApi = {
	list: (
		companyId: string,
		params?: { page?: number; perPage?: number; status?: string; clientId?: string }
	) => api.get<PaginatedResult<Invoice>>('/invoices', { companyId, ...params }),

	get: (id: string, companyId: string) => api.get<Invoice>(`/invoices/${id}`, { companyId }),

	create: (data: {
		companyId: string;
		clientId: string;
		issueDate?: string;
		dueDate?: string;
		notes?: string;
		terms?: string;
		items: Array<{
			productId?: string;
			description: string;
			quantity: number;
			unitPrice: number;
			taxRate?: number;
		}>;
	}) => api.post<Invoice>('/invoices', data),

	update: (id: string, companyId: string, data: Partial<Invoice>) =>
		api.put<Invoice>(`/invoices/${id}?companyId=${companyId}`, data),

	markAsSent: (id: string, companyId: string) =>
		api.post<Invoice>(`/invoices/${id}/send?companyId=${companyId}`),

	recordPayment: (id: string, companyId: string, amount: number) =>
		api.post<Invoice>(`/invoices/${id}/pay?companyId=${companyId}`, { amount }),

	cancel: (id: string, companyId: string, reason: string) =>
		api.delete<Invoice>(`/invoices/${id}`, { companyId, reason } as never),

	// Line item management
	addItem: (
		id: string,
		companyId: string,
		item: {
			productId?: string;
			description: string;
			quantity: number;
			unitPrice: number;
			taxRate?: number;
		}
	) => api.post<Invoice>(`/invoices/${id}/items?companyId=${companyId}`, item),

	updateItem: (
		id: string,
		itemId: string,
		companyId: string,
		data: Partial<{
			productId?: string;
			description: string;
			quantity: number;
			unitPrice: number;
			taxRate?: number;
		}>
	) => api.put<Invoice>(`/invoices/${id}/items/${itemId}?companyId=${companyId}`, data),

	removeItem: (id: string, itemId: string, companyId: string) =>
		api.delete<Invoice>(`/invoices/${id}/items/${itemId}`, { companyId }),

	// PDF
	getPdfUrl: (id: string, companyId: string, download = false) =>
		`${API_BASE_URL}/invoices/${id}/pdf?companyId=${companyId}&download=${download}`
};

// Payments - flat routes with companyId as query param
export const paymentsApi = {
	list: (
		companyId: string,
		params?: { page?: number; perPage?: number; invoiceId?: string; clientId?: string }
	) => api.get<PaginatedResult<Payment>>('/payments', { companyId, ...params }),

	get: (id: string, companyId: string) => api.get<Payment>(`/payments/${id}`, { companyId }),

	getByInvoice: (invoiceId: string, companyId: string) =>
		api.get<Payment[]>(`/payments/invoice/${invoiceId}`, { companyId }),

	getInvoiceSummary: (invoiceId: string, companyId: string) =>
		api.get<{
			invoiceTotal: number;
			amountPaid: number;
			balance: number;
			payments: Payment[];
		}>(`/payments/invoice/${invoiceId}/summary`, { companyId }),

	create: (data: {
		companyId: string;
		invoiceId: string;
		amount: number;
		paymentDate: string;
		paymentMethod: string;
		reference?: string;
		notes?: string;
		allocations?: Array<{ invoiceItemId: string; amount: number }>;
	}) => api.post<Payment>('/payments', data),

	refund: (id: string, companyId: string, reason?: string) =>
		api.post<Payment>(`/payments/${id}/refund?companyId=${companyId}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`)
};

// Credit Notes - flat routes with companyId as query param
export const creditNotesApi = {
	list: (
		companyId: string,
		params?: { page?: number; perPage?: number; status?: string; clientId?: string }
	) => api.get<PaginatedResult<CreditNote>>('/credit-notes', { companyId, ...params }),

	get: (id: string, companyId: string) => api.get<CreditNote>(`/credit-notes/${id}`, { companyId }),

	create: (data: {
		companyId: string;
		clientId: string;
		invoiceId: string;
		issueDate?: string;
		reason: string;
		notes?: string;
		items: Array<{
			invoiceItemId?: string;
			productId?: string;
			description: string;
			quantity: number;
			unitPrice: number;
			taxRate?: number;
		}>;
	}) => api.post<CreditNote>('/credit-notes', data),

	update: (id: string, companyId: string, data: Partial<CreditNote>) =>
		api.put<CreditNote>(`/credit-notes/${id}?companyId=${companyId}`, data),

	issue: (id: string, companyId: string) =>
		api.post<CreditNote>(`/credit-notes/${id}/issue?companyId=${companyId}`),

	apply: (id: string, companyId: string, invoiceId: string, amount: number) =>
		api.post<CreditNote>(`/credit-notes/${id}/apply?companyId=${companyId}`, { invoiceId, amount }),

	void: (id: string, companyId: string, reason: string) =>
		api.delete<CreditNote>(`/credit-notes/${id}`, { companyId, reason } as never),

	// PDF
	getPdfUrl: (id: string, companyId: string, download = false) =>
		`${API_BASE_URL}/credit-notes/${id}/pdf?companyId=${companyId}&download=${download}`
};

// Statements
export const statementsApi = {
	getClientStatement: (
		clientId: string,
		companyId: string,
		params?: { startDate?: string; endDate?: string }
	) =>
		api.get<{
			clientId: string;
			clientName: string;
			clientEmail: string;
			companyId: string;
			companyName: string;
			periodStart: string;
			periodEnd: string;
			openingBalance: number;
			lineItems: Array<{
				date: string;
				type: 'invoice' | 'payment' | 'credit_note';
				reference: string;
				description: string;
				debit?: number;
				credit?: number;
				balance: number;
			}>;
			totalInvoiced: number;
			totalPayments: number;
			totalCredits: number;
			closingBalance: number;
			generatedAt: string;
		}>(`/statements/client/${clientId}`, { companyId, ...params }),

	getClientStatementPdfUrl: (
		clientId: string,
		companyId: string,
		params?: { startDate?: string; endDate?: string; download?: boolean }
	) => {
		const searchParams = new URLSearchParams({ companyId });
		if (params?.startDate) searchParams.append('startDate', params.startDate);
		if (params?.endDate) searchParams.append('endDate', params.endDate);
		if (params?.download) searchParams.append('download', 'true');
		return `${API_BASE_URL}/statements/client/${clientId}/pdf?${searchParams.toString()}`;
	},

	getInvoiceStatement: (invoiceId: string, companyId: string) =>
		api.get<{
			invoiceId: string;
			invoiceNumber: string;
			clientName: string;
			invoiceDate: string;
			dueDate: string;
			status: string;
			invoiceTotal: number;
			lineItems: Array<{
				itemId: string;
				description: string;
				lineTotal: number;
				amountPaid: number;
				amountRemaining: number;
				isPaid: boolean;
			}>;
			payments: Array<{
				paymentId: string;
				paymentNumber: string;
				paymentDate: string;
				amount: number;
				paymentMethod: string;
				reference?: string;
			}>;
			totalPaid: number;
			balance: number;
			generatedAt: string;
		}>(`/statements/invoice/${invoiceId}`, { companyId })
};

// Stats DTOs
export interface InvoiceStats {
	totalInvoices: number;
	draftCount: number;
	sentCount: number;
	paidCount: number;
	overdueCount: number;
	partialCount: number;
	totalRevenue: number;
	totalOutstanding: number;
	totalOverdue: number;
}

export interface QuoteStats {
	totalQuotes: number;
	acceptedCount: number;
	rejectedCount: number;
	pendingCount: number;
	convertedCount: number;
	totalAcceptedValue: number;
	conversionRate: number;
}

export interface CompanyStats {
	invoices: InvoiceStats;
	quotes: QuoteStats;
	totalClients: number;
	totalProducts: number;
}

export interface ClientStats {
	clientId: string;
	clientName: string;
	totalInvoices: number;
	totalInvoiced: number;
	totalPaid: number;
	outstandingBalance: number;
	overdueAmount: number;
	totalQuotes: number;
	totalCreditNotes: number;
	lastInvoiceDate?: string;
}

// Stats API
export const statsApi = {
	getCompanyStats: (companyId: string) =>
		api.get<CompanyStats>('/stats/company', { companyId }),

	getInvoiceStats: (companyId: string) =>
		api.get<InvoiceStats>('/stats/invoices', { companyId }),

	getQuoteStats: (companyId: string) =>
		api.get<QuoteStats>('/stats/quotes', { companyId }),

	getClientStats: (clientId: string, companyId: string) =>
		api.get<ClientStats>(`/stats/clients/${clientId}`, { companyId }),

	getTopClients: (
		companyId: string,
		params?: { limit?: number; orderBy?: 'totalInvoiced' | 'totalPaid' | 'outstandingBalance' }
	) => api.get<ClientStats[]>('/stats/top-clients', { companyId, ...params })
};
