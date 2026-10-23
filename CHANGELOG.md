# Changelog

## [1.0.2] - 2026-10-23
### Security
- Mandate, transaction and proof nonce IDs now use crypto.randomUUID (was Math.random).
- zod ^4.6.7 (GHSA-mrhx-c7xc-m3w5).
### Docs
- Corrected claims: `buildPaymentProof()` is unsigned and is not proof of payment; `handle()` does not execute or verify payments. The 1.0.0 "EIP-712 signing support" entry was inaccurate: no signing is performed by this package.

## [1.0.0] - 2026-03-23

### Added
- Initial release of AP2 payment handler with x402 support
- USDC/Base payment processing
- EIP-712 signing support
- Zero key escrow architecture
