export const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code);
