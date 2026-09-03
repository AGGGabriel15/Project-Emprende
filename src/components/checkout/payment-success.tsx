"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";

export function PaymentSuccess() {
  const clear = useCart((state) => state.clear);
  useEffect(() => clear(), [clear]);
  return null;
}
