import { useEffect, type PropsWithChildren } from "react";

import { useCartStore } from "@/features/cart/model/cart.store";

export function CartBootstrap({ children }: PropsWithChildren) {
  const hydrate = useCartStore((state) => state.hydrate);
  const hydrationStatus = useCartStore((state) => state.hydrationStatus);

  useEffect(() => {
    if (hydrationStatus === "idle") {
      void hydrate();
    }
  }, [hydrate, hydrationStatus]);

  return children;
}
