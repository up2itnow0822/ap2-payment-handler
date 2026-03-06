import { AP2PaymentResponse } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class X402Bridge {
  /**
   * Parse an HTTP 402 Payment Required response headers to extract payment details.
   */
  async parsePaymentRequired(
    headers: Record<string, string>
  ): Promise<{ amount: string; currency: string; address: string }> {
    const paymentHeader = headers['x-payment-required'] || headers['X-Payment-Required'];
    if (paymentHeader) {
      try {
        const parsed = JSON.parse(paymentHeader);
        return {
          amount: parsed.amount || '0',
          currency: parsed.currency || 'USDC',
          address: parsed.address || '',
        };
      } catch {
        // fall through to individual headers
      }
    }

    const amount = headers['x-payment-amount'] || headers['X-Payment-Amount'] || '0';
    const currency = headers['x-payment-currency'] || headers['X-Payment-Currency'] || 'USDC';
    const address = headers['x-payment-address'] || headers['X-Payment-Address'] || '';

    if (!address) {
      throw new Error('Missing payment address in 402 response headers');
    }

    return { amount, currency, address };
  }

  /**
   * Build a non-custodial payment proof for a given payment request.
   */
  async buildPaymentProof(params: {
    amount: string;
    currency: string;
    address: string;
    agentId: string;
  }): Promise<{ proof: string; timestamp: number }> {
    const timestamp = Date.now();
    const proofData = {
      agentId: params.agentId,
      amount: params.amount,
      currency: params.currency,
      address: params.address,
      timestamp,
      nonce: generateId(),
    };
    // In production this would be EIP-712 signed. Here we encode it.
    const proof = Buffer.from(JSON.stringify(proofData)).toString('base64');
    return { proof, timestamp };
  }

  /**
   * Handle an HTTP response. Returns an AP2PaymentResponse if it's a 402, null otherwise.
   */
  async handleResponse(response: {
    status: number;
    headers: Record<string, string>;
  }): Promise<AP2PaymentResponse | null> {
    if (response.status !== 402) {
      return null;
    }

    try {
      const paymentDetails = await this.parsePaymentRequired(response.headers);
      return {
        success: false,
        error: `Payment required: ${paymentDetails.amount} ${paymentDetails.currency} to ${paymentDetails.address}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `402 Payment Required: ${(err as Error).message}`,
      };
    }
  }
}
