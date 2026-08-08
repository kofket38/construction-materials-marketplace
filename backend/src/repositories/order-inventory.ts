import {
  InventoryTransactionType,
  type Prisma,
} from "../prisma/generated/client.js";
import {
  InsufficientProductStockError,
  OrderProductNotFoundError,
} from "./order.errors.js";

interface OrderInventoryItem {
  productId: string;
  quantity: number;
}

export async function reserveOrderInventory(
  transaction: Prisma.TransactionClient,
  orderId: string,
  items: OrderInventoryItem[],
): Promise<void> {
  for (const item of items) {
    const existingTransaction =
      await transaction.inventoryTransaction.findUnique({
        where: {
          orderId_productId_type: {
            orderId,
            productId: item.productId,
            type: InventoryTransactionType.ORDER_SHIPMENT,
          },
        },
        select: { id: true },
      });

    if (existingTransaction) {
      continue;
    }

    const stockUpdate = await transaction.product.updateMany({
      where: {
        id: item.productId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
      },
    });

    if (stockUpdate.count !== 1) {
      const product = await transaction.product.findUnique({
        where: { id: item.productId },
        select: { id: true },
      });

      if (!product) {
        throw new OrderProductNotFoundError(item.productId);
      }
      throw new InsufficientProductStockError(item.productId);
    }

    await transaction.inventoryTransaction.create({
      data: {
        orderId,
        productId: item.productId,
        // Keep the legacy enum value so existing migrations and ledger rows
        // remain compatible; this transaction now records checkout reservation.
        type: InventoryTransactionType.ORDER_SHIPMENT,
        quantityChange: -item.quantity,
      },
    });
  }
}

export async function restoreOrderInventory(
  transaction: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const shipmentTransactions =
    await transaction.inventoryTransaction.findMany({
      where: {
        orderId,
        type: InventoryTransactionType.ORDER_SHIPMENT,
      },
      select: {
        productId: true,
        quantityChange: true,
      },
    });

  for (const shipment of shipmentTransactions) {
    const existingReversal =
      await transaction.inventoryTransaction.findUnique({
        where: {
          orderId_productId_type: {
            orderId,
            productId: shipment.productId,
            type: InventoryTransactionType.ORDER_CANCELLATION,
          },
        },
        select: { id: true },
      });

    if (existingReversal) {
      continue;
    }

    const restoredQuantity = -shipment.quantityChange;
    await transaction.product.update({
      where: { id: shipment.productId },
      data: {
        quantity: { increment: restoredQuantity },
      },
    });
    await transaction.inventoryTransaction.create({
      data: {
        orderId,
        productId: shipment.productId,
        type: InventoryTransactionType.ORDER_CANCELLATION,
        quantityChange: restoredQuantity,
      },
    });
  }
}
