# Deferred Work

## From: HDFC Bank PDF importer (2026-08-22)

- Bank PDF importers (HDFC/ICICI/Kotak) silently skip rows that fail trailing-amount match — no partial-import warning.
- Type inference defaults to expense when opening balance / prior balance is missing; Withdrawal vs Deposit columns are not recovered from collapsed PDF text when chaining breaks.
- No `|delta| === amount` consistency check before accepting a row.
- Alphanumeric / short cheque refs (<10 digits) are not supported by the trailing matcher.
- Value date is captured then discarded (transaction date only).
- `transfer` type is never assigned for own-account NEFT/IMPS.
- Empty/scanned PDFs can yield a successful empty import with no error.
- Opening-balance regex is tied to the NetBanking statement-summary layout; alternate summaries may mis-parse.
- UPI merchant heuristic may truncate hyphenated single-token payee names (`AMAZON-PAY`).
