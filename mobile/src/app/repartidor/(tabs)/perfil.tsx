import { Bell, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { VEHICLE_LABEL } from '@/features/couriers/status';
import { ProfileForm } from '~/components/account/profile-form';
import { Button } from '~/components/ui/button';
import { Card, InfoRow } from '~/components/ui/card';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useSession } from '~/features/auth/session';
import { useCourier } from '~/features/couriers/queries';

export default function CourierProfile() {
  const router = useRouter();
  const { signOut } = useSession();
  const courier = useCourier();
  const c = courier.data;
  return (
    <Screen edges={['top']}>
      <Text variant="title">Mi perfil</Text>
      <ProfileForm />
      {c && (
        <Card>
          <Text variant="heading">Vehículo</Text>
          <InfoRow label="Tipo" value={VEHICLE_LABEL[c.vehicle]} />
          {c.plate ? <InfoRow label="Placa" value={c.plate} /> : null}
          <Text variant="small" tone="muted">
            Para cambiar el vehículo o la placa, habla con la administración.
          </Text>
        </Card>
      )}
      <Button variant="outline" icon={Bell} onPress={() => router.push('/notificaciones')}>
        Notificaciones
      </Button>
      <Button variant="ghost" icon={LogOut} onPress={signOut}>
        Cerrar sesión
      </Button>
    </Screen>
  );
}
