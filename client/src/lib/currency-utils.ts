/**
 * Currency formatting utilities for Nigerian Naira
 */

export interface CurrencyFormatOptions {
  compact?: boolean;
  showSymbol?: boolean;
  precision?: number;
}

/**
 * Format currency with smart scaling for large numbers
 */
export function formatCurrency(
  amount: string | number, 
  options: CurrencyFormatOptions = {}
): string {
  const {
    compact = true,
    showSymbol = true,
    precision = 2
  } = options;

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return showSymbol ? '₦0' : '0';

  const symbol = showSymbol ? '₦' : '';

  // For compact formatting, scale large numbers
  if (compact && Math.abs(num) >= 1000) {
    if (Math.abs(num) >= 1000000000) {
      // Billions
      const scaled = num / 1000000000;
      return `${symbol}${scaled.toFixed(scaled % 1 === 0 ? 0 : 1)}B`;
    } else if (Math.abs(num) >= 1000000) {
      // Millions
      const scaled = num / 1000000;
      return `${symbol}${scaled.toFixed(scaled % 1 === 0 ? 0 : 1)}M`;
    } else if (Math.abs(num) >= 1000) {
      // Thousands
      const scaled = num / 1000;
      return `${symbol}${scaled.toFixed(scaled % 1 === 0 ? 0 : 1)}K`;
    }
  }

  // For smaller numbers or non-compact formatting
  return new Intl.NumberFormat('en-NG', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(num);
}

/**
 * Format currency for display in tables and cards (compact by default)
 */
export function formatDisplayCurrency(amount: string | number): string {
  return formatCurrency(amount, { compact: true, showSymbol: true });
}

/**
 * Format currency for detailed views (full format)
 */
export function formatDetailCurrency(amount: string | number): string {
  return formatCurrency(amount, { compact: false, showSymbol: true });
}

/**
 * Format currency for exports (no symbol, full precision)
 */
export function formatExportCurrency(amount: string | number): string {
  return formatCurrency(amount, { compact: false, showSymbol: false, precision: 2 });
}