import type { UserCarts } from "@/features/cart/model/cart";

export interface CartRepository {
  clear(): Promise<void>;
  load(): Promise<UserCarts>;
  save(cartsByUserId: UserCarts): Promise<void>;
}
