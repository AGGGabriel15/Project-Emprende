import { OrdersList } from "@/components/orders/orders-list";

export default function EntrepreneurOrdersPage() {
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Operación
      </p>
      <h1 className="mt-2 mb-8 text-5xl font-bold">Pedidos recibidos</h1>
      <OrdersList manageable />
    </>
  );
}
