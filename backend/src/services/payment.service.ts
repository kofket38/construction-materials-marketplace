import {
  PaymentAlreadySubmittedError,
  PaymentOrderStateChangedError,
} from "../repositories/payment.errors.js";
import type {
  PaymentEntity,
  PaymentRepository,
} from "../repositories/payment.repository.js";
import type {
  OrderEntity,
  OrderRepository,
} from "../repositories/order.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type {
  ManualPaymentMethod,
  PaymentDestination,
} from "../types/payment.js";
import { isManualPaymentMethod } from "../types/payment.js";
import type {
  SellerPaymentProfile,
  SellerPaymentRepository,
} from "../repositories/seller-payment.repository.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type { SubmitManualPaymentBody } from "../validators/payment.validators.js";
import type {
  PaymentProofStorage,
  SupportedPaymentProofMimeType,
} from "./payment-proof-storage.js";

const MAX_PAYMENT_PROOF_SIZE = 5 * 1024 * 1024;
const supportedMimeTypes = new Set<SupportedPaymentProofMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface UploadedPaymentProof {
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface ManualPaymentDetails {
  order: {
    id: string;
    status: string;
    paymentMethod: ManualPaymentMethod;
    totalAmount: string;
  };
  payment: PaymentEntity | null;
  paymentDestination: PaymentDestination;
}

export interface CheckoutPaymentOptions {
  seller: {
    id: string;
    name: string;
    phone: string;
  };
  paymentDestinations: PaymentDestination[];
}

type ManualPaymentOrder = OrderEntity & {
  paymentMethod: ManualPaymentMethod;
};

export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: OrderRepository,
    private readonly sellerPayments: SellerPaymentRepository,
    private readonly proofStorage: PaymentProofStorage,
  ) {}

  async findCheckoutOptions(
    actor: AuthenticatedUser,
    productIds: string[],
  ): Promise<CheckoutPaymentOptions> {
    this.requireCustomer(actor);
    const resolution =
      await this.sellerPayments.resolveCheckoutSellers(productIds);
    if (resolution.missingProductIds.length > 0) {
      throw new NotFoundError(
        "One or more products are no longer available.",
      );
    }
    if (resolution.sellerIds.length !== 1) {
      throw new BadRequestError(
        "Digital payment is available for single-seller carts only.",
      );
    }

    const profile = await this.requireSellerPaymentProfile(
      resolution.sellerIds[0]!,
    );
    return {
      seller: {
        id: profile.sellerId,
        name: profile.sellerName,
        phone: profile.sellerPhone,
      },
      paymentDestinations: profile.destinations,
    };
  }

  async submitManualPayment(
    actor: AuthenticatedUser,
    input: SubmitManualPaymentBody,
    proof: UploadedPaymentProof | undefined,
  ): Promise<PaymentEntity> {
    this.requireCustomer(actor);
    const order = await this.requireOwnedManualPaymentOrder(
      input.orderId,
      actor.userId,
    );

    if (order.status !== "PENDING_PAYMENT") {
      throw new ConflictError(
        order.status === "PENDING_PAYMENT_VERIFICATION"
          ? "Payment proof has already been submitted for this order."
          : "This order is no longer awaiting manual payment.",
      );
    }

    const paymentDestination = await this.requireOrderPaymentDestination(
      order,
    );

    const validatedProof = validatePaymentProof(proof);
    const storedProof = await this.proofStorage.save({
      buffer: validatedProof.buffer,
      mimeType: validatedProof.mimeType,
      orderId: order.id,
    });

    try {
      return await this.payments.createManual({
        orderId: order.id,
        customerId: actor.userId,
        method: paymentDestination.method,
        providerName: paymentDestination.providerName,
        proofImageUrl: storedProof.url,
      });
    } catch (error) {
      await this.proofStorage.remove(storedProof);

      if (error instanceof PaymentAlreadySubmittedError) {
        throw new ConflictError(error.message);
      }
      if (error instanceof PaymentOrderStateChangedError) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async findByOrderId(
    actor: AuthenticatedUser,
    orderId: string,
  ): Promise<ManualPaymentDetails> {
    this.requireCustomer(actor);
    const order = await this.requireOwnedManualPaymentOrder(
      orderId,
      actor.userId,
    );
    const payment = await this.payments.findByOrderId(order.id);
    const paymentDestination = await this.requireOrderPaymentDestination(
      order,
    );

    return {
      order: {
        id: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
      },
      payment,
      paymentDestination,
    };
  }

  private async requireOwnedManualPaymentOrder(
    orderId: string,
    customerId: string,
  ): Promise<ManualPaymentOrder> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.customerId !== customerId) {
      throw new ForbiddenError(
        "You can only submit payment for your own orders.",
      );
    }
    if (!isManualPaymentMethod(order.paymentMethod)) {
      throw new BadRequestError(
        "This order does not require manual payment proof.",
      );
    }
    return order as ManualPaymentOrder;
  }

  private requireCustomer(actor: AuthenticatedUser): void {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Customer access is required.");
    }
  }

  private async requireOrderPaymentDestination(
    order: ManualPaymentOrder,
  ): Promise<PaymentDestination> {
    const sellerIds = [
      ...new Set(order.items.map((item) => item.product.sellerId)),
    ];
    if (sellerIds.length !== 1) {
      throw new BadRequestError(
        "This order does not have a single payment recipient.",
      );
    }

    const profile = await this.requireSellerPaymentProfile(sellerIds[0]!);
    const directDestination = profile.destinations.find(
      (destination) => destination.method === order.paymentMethod,
    );
    if (directDestination) {
      return directDestination;
    }

    const legacyMethod =
      order.paymentMethod === "BANK_TRANSFER"
        ? "CBE_BANK"
        : order.paymentMethod === "AWASH_BIRR"
          ? "AWASH_BANK"
          : null;
    const legacyDestination = legacyMethod
      ? profile.destinations.find(
          (destination) => destination.method === legacyMethod,
        )
      : null;
    if (legacyDestination) {
      return {
        ...legacyDestination,
        method: order.paymentMethod,
      };
    }

    throw new NotFoundError(
      "The seller has not configured this payment provider.",
    );
  }

  private async requireSellerPaymentProfile(
    sellerId: string,
  ): Promise<SellerPaymentProfile> {
    const profile = await this.sellerPayments.findBySellerId(sellerId);
    if (!profile) {
      throw new NotFoundError("Seller payment information is unavailable.");
    }
    return profile;
  }
}

function validatePaymentProof(
  proof: UploadedPaymentProof | undefined,
): {
  buffer: Buffer;
  mimeType: SupportedPaymentProofMimeType;
} {
  if (!proof) {
    throw new BadRequestError("Request validation failed.", [
      {
        field: "body.proof",
        message: "Upload a payment screenshot.",
      },
    ]);
  }
  if (proof.size < 1 || proof.buffer.length < 1) {
    throw new BadRequestError("Request validation failed.", [
      {
        field: "body.proof",
        message: "The payment screenshot is empty.",
      },
    ]);
  }
  if (proof.size > MAX_PAYMENT_PROOF_SIZE) {
    throw new BadRequestError("Request validation failed.", [
      {
        field: "body.proof",
        message: "The payment screenshot must not exceed 5 MB.",
      },
    ]);
  }
  if (!supportedMimeTypes.has(proof.mimeType as SupportedPaymentProofMimeType)) {
    throw invalidImageError();
  }

  const mimeType = proof.mimeType as SupportedPaymentProofMimeType;
  if (!hasExpectedImageSignature(proof.buffer, mimeType)) {
    throw invalidImageError();
  }

  return {
    buffer: proof.buffer,
    mimeType,
  };
}

function invalidImageError(): BadRequestError {
  return new BadRequestError("Request validation failed.", [
    {
      field: "body.proof",
      message: "Upload a valid JPEG, PNG, or WebP image.",
    },
  ]);
}

function hasExpectedImageSignature(
  buffer: Buffer,
  mimeType: SupportedPaymentProofMimeType,
): boolean {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      buffer.length >= pngSignature.length &&
      pngSignature.every((byte, index) => buffer[index] === byte)
    );
  }

  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}
