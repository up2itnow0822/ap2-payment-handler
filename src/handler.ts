import {
  AP2PaymentMethod,
  AP2PaymentRequest,
  AP2PaymentResponse,
  IntentMandate,
  CartMandate,
  PaymentMandate,
} from './types';
import { validateMandate } from './validation';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class AP2PaymentHandler {
  private supportedMethods: AP2PaymentMethod[];

  constructor(config: { supportedMethods: AP2PaymentMethod[] }) {
    this.supportedMethods = config.supportedMethods;
  }

  getSupportedMethods(): AP2PaymentMethod[] {
    return [...this.supportedMethods];
  }

  createIntentMandate(
    params: Omit<IntentMandate, 'type' | 'isAgentInitiated' | 'isNonCustodial'>
  ): IntentMandate {
    return {
      type: 'intent',
      isAgentInitiated: true,
      isNonCustodial: true,
      ...params,
    };
  }

  createCartMandate(params: Omit<CartMandate, 'type'>): CartMandate {
    return {
      type: 'cart',
      ...params,
    };
  }

  private selectMethod(preferred: AP2PaymentMethod): AP2PaymentMethod | null {
    if (this.supportedMethods.includes(preferred)) {
      return preferred;
    }
    // Fallback to first supported method
    return this.supportedMethods.length > 0 ? this.supportedMethods[0] : null;
  }

  private getAmount(mandate: IntentMandate | CartMandate): number {
    if (mandate.type === 'intent') {
      return mandate.maxAmount;
    }
    return mandate.total;
  }

  async handle(request: AP2PaymentRequest): Promise<AP2PaymentResponse> {
    try {
      validateMandate(request.mandate);
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }

    const method = this.selectMethod(request.preferredMethod);
    if (!method) {
      return {
        success: false,
        error: 'No supported payment methods available',
      };
    }

    const mandateId = generateId();
    const timestamp = Date.now();
    const amount = this.getAmount(request.mandate);

    const auditTrail: string[] = [
      `[${new Date(timestamp).toISOString()}] Mandate received: type=${request.mandate.type}, agentId=${request.mandate.agentId}`,
      `[${new Date(timestamp).toISOString()}] Payment method selected: ${method}`,
      `[${new Date(timestamp).toISOString()}] Non-custodial payment initiated: amount=${amount} ${request.mandate.currency}`,
      `[${new Date(timestamp).toISOString()}] MandateId assigned: ${mandateId}`,
    ];

    const paymentMandate: PaymentMandate = {
      type: 'payment',
      mandateId,
      method,
      amount,
      currency: request.mandate.currency,
      auditTrail,
      timestamp,
      isNonCustodial: true,
    };

    const transactionId = `tx_${generateId()}`;

    return {
      success: true,
      transactionId,
      paymentMandate,
    };
  }
}
