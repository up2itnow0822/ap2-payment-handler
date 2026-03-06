import { IntentMandate, CartMandate } from './types';

export class AP2ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AP2ValidationError';
  }
}

export function validateMandate(mandate: IntentMandate | CartMandate): void {
  if (!mandate.agentId) {
    throw new AP2ValidationError('Missing required field: agentId');
  }

  if (mandate.type === 'intent') {
    if (!mandate.merchantId) {
      throw new AP2ValidationError('Missing required field: merchantId');
    }
    if (mandate.maxAmount === undefined || mandate.maxAmount === null) {
      throw new AP2ValidationError('Missing required field: maxAmount');
    }
    if (typeof mandate.maxAmount !== 'number' || mandate.maxAmount <= 0) {
      throw new AP2ValidationError('maxAmount must be a positive number');
    }
    if (!mandate.currency) {
      throw new AP2ValidationError('Missing required field: currency');
    }
    if (!mandate.ttl) {
      throw new AP2ValidationError('Missing required field: ttl');
    }
    if (mandate.ttl < Date.now()) {
      throw new AP2ValidationError('IntentMandate TTL has expired');
    }
  } else if (mandate.type === 'cart') {
    if (!mandate.lineItems || mandate.lineItems.length === 0) {
      throw new AP2ValidationError('CartMandate must have at least one line item');
    }
    if (!mandate.currency) {
      throw new AP2ValidationError('Missing required field: currency');
    }
    if (mandate.total === undefined || mandate.total === null) {
      throw new AP2ValidationError('Missing required field: total');
    }
    if (typeof mandate.total !== 'number' || mandate.total <= 0) {
      throw new AP2ValidationError('total must be a positive number');
    }

    const computedTotal = mandate.lineItems.reduce((sum, item) => {
      return sum + item.price * item.qty;
    }, 0);

    const diff = Math.abs(computedTotal - mandate.total);
    if (diff > 0.001) {
      throw new AP2ValidationError(
        `CartMandate total mismatch: expected ${computedTotal.toFixed(4)}, got ${mandate.total.toFixed(4)}`
      );
    }
  } else {
    throw new AP2ValidationError('Unknown mandate type');
  }
}
