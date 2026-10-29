import { Stack } from 'expo-router';
import { ProfileForm } from '~/components/account/profile-form';
import { Screen } from '~/components/ui/screen';

export default function VendorProfile() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mi perfil' }} />
      <ProfileForm />
    </Screen>
  );
}
