import {
  InventoryTransactionType,
  type Prisma,
} from "../prisma/generated/client.js";
import {
  InsufficientProductStockError,
  OrderProductNotFoundError,
  SellerInventoryNotFoundError,
} from "./order.errors.js";

export interface OrderInventoryItem {
  productId: string;
  sellerId: string;
  quantity: number;
}

export async function reserveOrderInventory(
  transaction: Prisma.TransactionClient,
  orderId: string,
  items: OrderInventoryItem[],
): Promise<void> {
  for (const item of items) {
    // Idempotency: skip if this product's reservation was already recorded.
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

    // Fetch the SellerInventory row to get the city and validate existence.
    const inventoryRow = await transaction.sellerInventory.findUnique({
      where: {
        sellerId_productId: {
          sellerId: item.sellerId,
          productId: item.productId,
        },
      },
      select: { city: true, quantity: true },
    });

    if (!inventoryRow) {
      // Distinguish between a missing product and a missing inventory entry.
      const productExists = await transaction.product.findUnique({
        where: { id: item.productId },
        select: { id: true },
      });
      if (!productExists) {
        throw new OrderProductNotFoundError(item.productId);
      }
      throw new SellerInventoryNotFoundError(item.productId, item.sellerId);
    }

    // Atomic decrement: only succeeds when stock is sufficient.
    const stockUpdate = await transaction.sellerInventory.updateMany({
      where: {
        sellerId: item.sellerId,
        productId: item.productId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
      },
    });

    if (stockUpdate.count !== 1) {
      throw new InsufficientProductStockError(item.productId);
    }

    await transaction.inventoryTransaction.create({
      data: {
        orderId,
        productId: item.productId,
        sellerId: item.sellerId,
        city: inventoryRow.city,
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
        sellerId: true,
        city: true,
        quantityChange: true,
      },
    });

  for (const shipment of shipmentTransactions) {
    // Idempotency: skip if restoration was already recorded.
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

    // Restore the exact SellerInventory row that was decremented.
    await transaction.sellerInventory.updateMany({
      where: {
        sellerId: shipment.sellerId,
        productId: shipment.productId,
      },
      data: {
        quantity: { increment: restoredQuantity },
      },
    });

    await transaction.inventoryTransaction.create({
      data: {
        orderId,
        productId: shipment.productId,
        sellerId: shipment.sellerId,
        city: shipment.city,
        type: InventoryTransactionType.ORDER_CANCELLATION,
        quantityChange: restoredQuantity,
      },
    });
  }
}
