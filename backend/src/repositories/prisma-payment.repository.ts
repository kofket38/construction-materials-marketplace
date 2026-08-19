import {
  OrderStatus,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  PaymentAlreadySubmittedError,
  PaymentOrderStateChangedError,
} from "./payment.errors.js";
import type {
  CreateManualPaymentInput,
  PaymentEntity,
  PaymentProofAuthorization,
  PaymentRepository,
} from "./payment.repository.js";

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly client: PrismaClient) {}

  async createManual(
    input: CreateManualPaymentInput,
  ): Promise<PaymentEntity> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const updatedOrder = await transaction.order.updateMany({
          where: {
            id: input.orderId,
            customerId: input.customerId,
            paymentMethod: input.method,
            status: OrderStatus.PENDING_PAYMENT,
          },
          data: {
            status: OrderStatus.PENDING_PAYMENT_VERIFICATION,
          },
        });

        if (updatedOrder.count !== 1) {
          throw new PaymentOrderStateChangedError();
        }

        const payment = await transaction.payment.create({
          data: {
            orderId: input.orderId,
            method: input.method,
            providerName: input.providerName,
            proofImageUrl: input.proofImageUrl,
          },
        });

        return {
          ...payment,
          method: input.method,
        };
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new PaymentAlreadySubmittedError();
      }
      throw error;
    }
  }

  async findByOrderId(orderId: string): Promise<PaymentEntity | null> {
    const payment = await this.client.payment.findUnique({
      where: { orderId },
    });

    if (
      !payment ||
      payment.method === "CASH_ON_DELIVERY"
    ) {
      return null;
    }

    return {
      ...payment,
      method: payment.method,
    };
  }

  async findByProofFilename(
    filename: string,
  ): Promise<PaymentProofAuthorization | null> {
    const payment = await this.client.payment.findFirst({
      where: { proofImageUrl: filename },
      select: {
        proofImageUrl: true,
        order: {
          select: {
            customerId: true,
            items: {
              select: {
                product: {
                  select: { sellerId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) return null;

    const sellerIds = [
      ...new Set(payment.order.items.map((item) => item.product.sellerId)),
    ];

    return {
      proofFilename: payment.proofImageUrl,
      customerId: payment.order.customerId,
      sellerIds,
    };
  }
}
