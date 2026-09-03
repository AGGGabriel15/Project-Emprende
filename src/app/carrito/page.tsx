import { CartPage } from "@/components/cart/cart-page";

export default function CartRoute() {
  return (
    <div className="container-page py-12">
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Tu selección
      </p>
      <h1 className="mt-2 mb-9 text-5xl font-bold">Carrito</h1>
      <CartPage />
    </div>
  );
}
