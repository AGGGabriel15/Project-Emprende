import { Stack, useLocalSearchParams } from 'expo-router';
import { PackageX } from 'lucide-react-native';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { ProductEditor } from '~/components/vendor/product-editor';
import { useVendorProduct } from '~/features/vendor/queries';

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useVendorProduct(id);
  return (
    <>
      <Stack.Screen options={{ title: 'Editar producto' }} />
      {product.isLoading ? (
        <Screen>
          <Skeleton height={200} />
        </Screen>
      ) : product.data ? (
        <ProductEditor key={product.data.id} product={product.data} />
      ) : (
        <Screen>
          <EmptyState icon={PackageX} title="Producto no encontrado" />
        </Screen>
      )}
    </>
  );
}
