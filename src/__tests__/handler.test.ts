import { AP2PaymentHandler } from '../handler';
import { X402Bridge } from '../x402';
import { AP2ValidationError, validateMandate } from '../validation';
import { IntentMandate, CartMandate } from '../types';

const futureTime = Date.now() + 60_000; // 1 minute from now
const pastTime = Date.now() - 60_000;   // 1 minute ago

function makeIntentMandate(overrides: Partial<IntentMandate> = {}): IntentMandate {
  return {
    type: 'intent',
    agentId: 'agent-123',
    merchantId: 'merchant-456',
    maxAmount: 10.0,
    currency: 'USDC',
    ttl: futureTime,
    isAgentInitiated: true,
    isNonCustodial: true,
    ...overrides,
  };
}

function makeCartMandate(overrides: Partial<CartMandate> = {}): CartMandate {
  return {
    type: 'cart',
    agentId: 'agent-123',
    lineItems: [
      { name: 'Widget', price: 5.0, qty: 2 },
    ],
    total: 10.0,
    currency: 'USDC',
    ...overrides,
  };
}

describe('AP2PaymentHandler', () => {
  let handler: AP2PaymentHandler;

  beforeEach(() => {
    handler = new AP2PaymentHandler({ supportedMethods: ['usdc_base', 'x402'] });
  });

  // 1. IntentMandate creation with correct flags
  test('createIntentMandate sets isAgentInitiated and isNonCustodial', () => {
    const mandate = handler.createIntentMandate({
      agentId: 'a1',
      merchantId: 'm1',
      maxAmount: 5,
      currency: 'USDC',
      ttl: futureTime,
    });
    expect(mandate.isAgentInitiated).toBe(true);
    expect(mandate.isNonCustodial).toBe(true);
    expect(mandate.type).toBe('intent');
  });

  // 2. CartMandate total validation (correct sum)
  test('validateMandate accepts CartMandate with correct total', () => {
    const cart = makeCartMandate();
    expect(() => validateMandate(cart)).not.toThrow();
  });

  // 3. CartMandate total validation (wrong sum — should throw)
  test('validateMandate rejects CartMandate with wrong total', () => {
    const cart = makeCartMandate({ total: 99.0 });
    expect(() => validateMandate(cart)).toThrow(AP2ValidationError);
    expect(() => validateMandate(cart)).toThrow(/mismatch/);
  });

  // 4. IntentMandate TTL validation (future TTL — valid)
  test('validateMandate accepts IntentMandate with future TTL', () => {
    const intent = makeIntentMandate({ ttl: futureTime });
    expect(() => validateMandate(intent)).not.toThrow();
  });

  // 5. IntentMandate TTL validation (past TTL — invalid)
  test('validateMandate rejects IntentMandate with expired TTL', () => {
    const intent = makeIntentMandate({ ttl: pastTime });
    expect(() => validateMandate(intent)).toThrow(AP2ValidationError);
    expect(() => validateMandate(intent)).toThrow(/expired/);
  });

  // 6. Handler with usdc_base method
  test('handle succeeds with usdc_base method', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'usdc_base',
    });
    expect(response.success).toBe(true);
    expect(response.paymentMandate?.method).toBe('usdc_base');
  });

  // 7. Handler with x402 method
  test('handle succeeds with x402 method', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'x402',
    });
    expect(response.success).toBe(true);
    expect(response.paymentMandate?.method).toBe('x402');
  });

  // 8. Handler with unsupported method falls back
  test('handle falls back to first supported method when preferred is unsupported', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'usdc_arbitrum',
    });
    expect(response.success).toBe(true);
    expect(response.paymentMandate?.method).toBe('usdc_base');
  });

  // 9. Handler returns success with transactionId
  test('handle returns transactionId on success', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'usdc_base',
    });
    expect(response.success).toBe(true);
    expect(response.transactionId).toBeDefined();
    expect(typeof response.transactionId).toBe('string');
  });

  // 10. Handler audit trail includes entries
  test('handle returns paymentMandate with non-empty auditTrail', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'usdc_base',
    });
    expect(response.paymentMandate?.auditTrail.length).toBeGreaterThan(0);
  });

  // 11. PaymentMandate has isNonCustodial flag
  test('paymentMandate has isNonCustodial set to true', async () => {
    const response = await handler.handle({
      mandate: makeIntentMandate(),
      preferredMethod: 'usdc_base',
    });
    expect(response.paymentMandate?.isNonCustodial).toBe(true);
  });

  // 16. Validation rejects missing agentId
  test('validateMandate rejects missing agentId', () => {
    const intent = makeIntentMandate({ agentId: '' });
    expect(() => validateMandate(intent)).toThrow(AP2ValidationError);
    expect(() => validateMandate(intent)).toThrow(/agentId/);
  });

  // 17. Validation rejects negative amount
  test('validateMandate rejects negative maxAmount on IntentMandate', () => {
    const intent = makeIntentMandate({ maxAmount: -5 });
    expect(() => validateMandate(intent)).toThrow(AP2ValidationError);
    expect(() => validateMandate(intent)).toThrow(/positive/);
  });

  // 18. createIntentMandate sets correct defaults
  test('createIntentMandate preserves all provided params', () => {
    const mandate = handler.createIntentMandate({
      agentId: 'myAgent',
      merchantId: 'myMerchant',
      maxAmount: 25,
      currency: 'USDC',
      ttl: futureTime,
    });
    expect(mandate.agentId).toBe('myAgent');
    expect(mandate.merchantId).toBe('myMerchant');
    expect(mandate.maxAmount).toBe(25);
    expect(mandate.currency).toBe('USDC');
  });

  // 19. createCartMandate with multiple items
  test('createCartMandate with multiple line items', () => {
    const mandate = handler.createCartMandate({
      agentId: 'agent-1',
      lineItems: [
        { name: 'Item A', price: 3, qty: 2 },
        { name: 'Item B', price: 4, qty: 1 },
      ],
      total: 10,
      currency: 'USDC',
    });
    expect(mandate.type).toBe('cart');
    expect(mandate.lineItems.length).toBe(2);
    expect(mandate.total).toBe(10);
  });

  // 20. getSupportedMethods returns config
  test('getSupportedMethods returns configured methods', () => {
    const methods = handler.getSupportedMethods();
    expect(methods).toContain('usdc_base');
    expect(methods).toContain('x402');
    expect(methods.length).toBe(2);
  });
});

describe('X402Bridge', () => {
  let bridge: X402Bridge;

  beforeEach(() => {
    bridge = new X402Bridge();
  });

  // 12. X402Bridge parsePaymentRequired
  test('parsePaymentRequired extracts payment details from headers', async () => {
    const headers = {
      'x-payment-amount': '5.00',
      'x-payment-currency': 'USDC',
      'x-payment-address': '0xabc123',
    };
    const result = await bridge.parsePaymentRequired(headers);
    expect(result.amount).toBe('5.00');
    expect(result.currency).toBe('USDC');
    expect(result.address).toBe('0xabc123');
  });

  // 13. X402Bridge buildPaymentProof
  test('buildPaymentProof returns a proof and timestamp', async () => {
    const result = await bridge.buildPaymentProof({
      amount: '5.00',
      currency: 'USDC',
      address: '0xabc123',
      agentId: 'agent-1',
    });
    expect(result.proof).toBeTruthy();
    expect(typeof result.proof).toBe('string');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  // 14. X402Bridge handleResponse for 402 status
  test('handleResponse returns AP2PaymentResponse for 402 status', async () => {
    const response = await bridge.handleResponse({
      status: 402,
      headers: {
        'x-payment-amount': '10.00',
        'x-payment-currency': 'USDC',
        'x-payment-address': '0xdef456',
      },
    });
    expect(response).not.toBeNull();
    expect(response?.success).toBe(false);
    expect(response?.error).toContain('Payment required');
  });

  // 15. X402Bridge handleResponse for 200 status (null)
  test('handleResponse returns null for non-402 status', async () => {
    const response = await bridge.handleResponse({
      status: 200,
      headers: {},
    });
    expect(response).toBeNull();
  });

  // Additional: parsePaymentRequired with JSON header
  test('parsePaymentRequired parses JSON x-payment-required header', async () => {
    const headers = {
      'x-payment-required': JSON.stringify({
        amount: '7.50',
        currency: 'USDC',
        address: '0xfeed',
      }),
    };
    const result = await bridge.parsePaymentRequired(headers);
    expect(result.amount).toBe('7.50');
    expect(result.address).toBe('0xfeed');
  });

  // Additional: buildPaymentProof encodes agentId
  test('buildPaymentProof encodes agentId in proof', async () => {
    const result = await bridge.buildPaymentProof({
      amount: '1.00',
      currency: 'USDC',
      address: '0xabc',
      agentId: 'agent-special',
    });
    const decoded = JSON.parse(Buffer.from(result.proof, 'base64').toString());
    expect(decoded.agentId).toBe('agent-special');
  });
});
