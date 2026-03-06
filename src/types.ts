export type AP2PaymentMethod = 'usdc_base' | 'x402' | 'usdc_arbitrum' | 'usdc_optimism';

export type MandateType = 'intent' | 'cart' | 'payment';

export interface IntentMandate {
  type: 'intent';
  agentId: string;
  merchantId: string;
  maxAmount: number;
  currency: string;
  ttl: number; // Unix timestamp ms
  isAgentInitiated: true;
  isNonCustodial: true;
  signature?: string;
}

export interface LineItem {
  name: string;
  price: number;
  qty: number;
}

export interface CartMandate {
  type: 'cart';
  agentId: string;
  lineItems: LineItem[];
  total: number;
  currency: string;
  signature?: string;
}

export interface PaymentMandate {
  type: 'payment';
  mandateId: string;
  method: AP2PaymentMethod;
  amount: number;
  currency: string;
  auditTrail: string[];
  timestamp: number;
  isNonCustodial: true;
}

export interface AP2PaymentRequest {
  mandate: IntentMandate | CartMandate;
  preferredMethod: AP2PaymentMethod;
}

export interface AP2PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  paymentMandate?: PaymentMandate;
}
