import { randomUUID } from "node:crypto";
import {
  PaymentAlreadySubmittedError,
  PaymentOrderStateChangedError,
} from "../../src/repositories/payment.errors.js";
import type {
  CreateManualPaymentInput,
  PaymentEntity,
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
}
