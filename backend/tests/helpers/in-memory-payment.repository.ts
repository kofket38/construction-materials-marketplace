import { randomUUID } from "node:crypto";
import {
  PaymentAlreadySubmittedError,
  PaymentOrderStateChangedError,
} from "../../src/repositories/payment.errors.js";
import type {
  CreateManualPaymentInput,
  PaymentEntity,
  PaymentProofAuthorization,
  PaymentRepository,
} from "../../src/repositories/payment.repository.js";
import { isManualPaymentMethod } from "../../src/types/payment.js";
import type { OrderRepository } from "../../src/repositories/order.repository.js";

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, PaymentEntity>();

  constructor(private readonly orders: OrderRepository) {}

  async createManual(
    input: CreateManualPaymentInput,
  ): Promise<PaymentEntity> {
    if (this.payments.has(input.orderId)) {
      throw new PaymentAlreadySubmittedError();
    }

    const order = await this.orders.findById(input.orderId);
    if (
      !order ||
      order.customerId !== input.customerId ||
      !isManualPaymentMethod(order.paymentMethod) ||
      order.paymentMethod !== input.method ||
      order.status !== "PENDING_PAYMENT"
    ) {
      throw new PaymentOrderStateChangedError();
    }

    await this.orders.updateStatus(
      order.id,
      "PENDING_PAYMENT_VERIFICATION",
    );

    const payment: PaymentEntity = {
      id: randomUUID(),
      orderId: input.orderId,
      method: input.method,
      providerName: input.providerName,
      proofImageUrl: input.proofImageUrl,
      status: "PENDING_VERIFICATION",
      createdAt: new Date(),
      verifiedAt: null,
    };
    this.payments.set(payment.orderId, payment);
    return payment;
  }

  async findByOrderId(orderId: string): Promise<PaymentEntity | null> {
    return this.payments.get(orderId) ?? null;
  }

  async findByProofFilename(
    filename: string,
  ): Promise<PaymentProofAuthorization | null> {
    for (const payment of this.payments.values()) {
      if (payment.proofImageUrl === filename) {
        const order = await this.orders.findById(payment.orderId);
        if (!order) return null;
        const sellerIds = [
          ...new Set(order.items.map((item) => item.product.sellerId)),
        ];
        return {
          proofFilename: payment.proofImageUrl,
          customerId: order.customerId,
          sellerIds,
        };
      }
    }
    return null;
  }
}
