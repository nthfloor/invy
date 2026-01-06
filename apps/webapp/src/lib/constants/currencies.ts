/**
 * Supported currency codes (ISO 4217)
 */
export const SUPPORTED_CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP'] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'ZAR';

/**
 * Currency display information for UI
 */
export const CURRENCY_INFO: Record<Currency, { code: Currency; name: string; symbol: string }> = {
	ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
	USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
	EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
	GBP: { code: 'GBP', name: 'British Pound', symbol: '£' }
};
