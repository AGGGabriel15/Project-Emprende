type PopulatedProduct = {
  _id: { toString(): string };
  name: string;
  slug: string;
  description: string;
  priceMinor: number;
  stock: number;
  images: string[];
  active: boolean;
  category: { _id: { toString(): string }; name: string; slug: string };
  entrepreneur: { _id: { toString(): string }; businessName: string };
};

export function serializeProduct(product: PopulatedProduct) {
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceMinor: product.priceMinor,
    stock: product.stock,
    images: product.images,
    active: product.active,
    category: {
      id: product.category._id.toString(),
      name: product.category.name,
      slug: product.category.slug,
    },
    entrepreneur: {
      id: product.entrepreneur._id.toString(),
      businessName: product.entrepreneur.businessName,
    },
  };
}
