# ap2-payment-handler

> Non-custodial crypto payment handler for the AP2 Agent Payment Protocol. The first open-source, zero-escrow AP2 implementation.

[![npm version](https://badge.fury.io/js/ap2-payment-handler.svg)](https://www.npmjs.com/package/ap2-payment-handler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is AP2?

AP2 (Agent Payment Protocol) is Google's emerging standard for agentic commerce — enabling AI agents to negotiate and execute payments autonomously on behalf of users. This package implements the AP2 mandate lifecycle with a non-custodial, crypto-native approach.

## Installation

```bash
npm install ap2-payment-handler
```

## Quick Start

```typescript
import { AP2PaymentHandler } from 'ap2-payment-handler';

const handler = new AP2PaymentHandler({
  supportedMethods: ['usdc_base', 'x402'],
});

// Create an intent mandate (agent-initiated)
const mandate = handler.createIntentMandate({
  agentId: 'my-agent-001',
  merchantId: 'merchant-xyz',
  maxAmount: 10.0,
  currency: 'USDC',
  ttl: Date.now() + 5 * 60_000, // 5 minutes
});

// Process payment
const response = await handler.handle({
  mandate,
  preferredMethod: 'usdc_base',
});

if (response.success) {
  console.log('Payment initiated:', response.transactionId);
  console.log('Audit trail:', response.paymentMandate?.auditTrail);
}
```

## Cart Payments

```typescript
const cartMandate = handler.createCartMandate({
  agentId: 'my-agent-001',
  lineItems: [
    { name: 'API Credits', price: 5.0, qty: 2 },
    { name: 'Priority Queue', price: 3.0, qty: 1 },
  ],
  total: 13.0,
  currency: 'USDC',
});

const response = await handler.handle({
  mandate: cartMandate,
  preferredMethod: 'usdc_base',
});
```

## HTTP 402 Payment Required (x402)

```typescript
import { X402Bridge } from 'ap2-payment-handler';

const bridge = new X402Bridge();

// When your agent receives a 402 response
const paymentResponse = await bridge.handleResponse({
  status: 402,
  headers: response.headers,
});

if (paymentResponse) {
  // Build proof and retry request
  const proof = await bridge.buildPaymentProof({
    amount: '5.00',
    currency: 'USDC',
    address: '0x...',
    agentId: 'my-agent-001',
  });
}
```

## Supported Payment Methods

| Method | Network | Description |
|--------|---------|-------------|
| `usdc_base` | Base (Coinbase L2) | USDC on Base — low fees, fast finality |
| `x402` | Any | HTTP 402 Payment Required flow |
| `usdc_arbitrum` | Arbitrum | USDC on Arbitrum One |
| `usdc_optimism` | Optimism | USDC on Optimism |

## Non-Custodial Design

This package is **zero-escrow** by design:

- **No private keys stored** — signing is delegated to your wallet/signer
- **No funds held** — payment proofs reference on-chain transactions
- **Full audit trail** — every mandate lifecycle step is logged
- **EIP-712 compatible** — structured signing for human-readable approval

All `PaymentMandate` objects carry `isNonCustodial: true` as a type-level guarantee.

## API Reference

### `AP2PaymentHandler`

- `constructor({ supportedMethods })` — initialize with supported payment methods
- `handle(request)` — process an AP2 payment request
- `createIntentMandate(params)` — create an agent-initiated intent mandate
- `createCartMandate(params)` — create a cart mandate from line items
- `getSupportedMethods()` — list configured methods

### `X402Bridge`

- `parsePaymentRequired(headers)` — extract payment details from 402 headers
- `buildPaymentProof(params)` — create a non-custodial payment proof
- `handleResponse(response)` — handle HTTP responses, returns AP2PaymentResponse for 402

### `validateMandate(mandate)`

Validates a mandate and throws `AP2ValidationError` on failure.

## License

MIT © [AI Agent Economy](https://ai-agent-economy.com)
