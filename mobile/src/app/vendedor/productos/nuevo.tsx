import { Stack } from 'expo-router';
import { ProductEditor } from '~/components/vendor/product-editor';

export default function NewProduct() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo producto' }} />
      <ProductEditor />
    </>
  );
}
