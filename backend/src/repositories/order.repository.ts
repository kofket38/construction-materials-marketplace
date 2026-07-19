export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface OrderProductSummary {
  id: string;
  sellerId: string;
  name: string;
  imageUrl: string | null;
}

export interface OrderItemEntity {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  product: OrderProductSummary;
}

export interface OrderEntity {
  id: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: string;
  customer: OrderCustomerSummary;
  items: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
}

export interface CancelOrderOptions {
  onlyIfPending: boolean;
}

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<OrderEntity>;
  findById(id: string): Promise<OrderEntity | null>;
  findByCustomerId(customerId: string): Promise<OrderEntity[]>;
  updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderEntity | null>;
  cancel(
    id: string,
    options: CancelOrderOptions,
  ): Promise<OrderEntity | null>;
}
