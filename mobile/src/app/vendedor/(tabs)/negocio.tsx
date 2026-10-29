import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bell, Bike, Clock, ExternalLink, FolderTree, LogOut, Settings, TrendingUp, UserRound, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { businessOpenState } from '@/features/catalog/meta';
import { TIER_INFO } from '@/lib/validations/business';
import { PatternBackground } from '~/components/brand/pattern';
import { OpenBadge } from '~/components/catalog/catalog-bits';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { MenuItem } from '~/components/ui/menu';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useNotifications } from '~/features/account/notifications';
import { useSession } from '~/features/auth/session';
import { useBusinessHours, useMyBusiness } from '~/features/vendor/queries';
import { colors, radius } from '~/theme/tokens';

export default function MyBusiness() {
  const router = useRouter();
  const { signOut } = useSession();
  const business = useMyBusiness().data!;
  const hours = useBusinessHours(business.id);
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;
  const state = hours.data
    ? businessOpenState({ ...business, category: null, business_hours: hours.data.hours, business_closures: hours.data.closures })
    : null;

  return (
    <Screen edges={['top']}>
      <Card padded={false} style={styles.head}>
        <View style={styles.cover}>
          {business.cover_url ? <Image source={business.cover_url} style={StyleSheet.absoluteFill} contentFit="cover" /> : <PatternBackground variant="green" tile={72} />}
        </View>
        <View style={styles.headBody}>
          <View style={styles.logo}>{business.logo_url ? <Image source={business.logo_url} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={styles.flex}>
            <Text variant="heading">{business.trade_name}</Text>
            <View style={styles.inline}>
              <Badge tone={business.tier === 'informal' ? 'violet' : 'brand'} icon={BadgeCheck}>
                {TIER_INFO[business.tier].label}
              </Badge>
              {business.status === 'suspended' && <Badge tone="red">Suspendido</Badge>}
            </View>
            {state && <OpenBadge state={state} />}
          </View>
        </View>
        <Button variant="secondary" size="sm" icon={ExternalLink} onPress={() => router.push(`/negocios/${business.slug}`)} style={styles.view}>
          Ver mi página
        </Button>
      </Card>

      <Card padded={false}>
        <MenuItem icon={Clock} label="Horarios" detail="Horario semanal, cierres y “Cerrar ahora”" onPress={() => router.push('/vendedor/horarios')} />
        <MenuItem icon={Settings} label="Configuración" detail="Nombre, logo, portada y contacto" onPress={() => router.push('/vendedor/configuracion')} />
        <MenuItem icon={FolderTree} label="Secciones de tu tienda" onPress={() => router.push('/vendedor/categorias')} />
        <MenuItem icon={Bike} label="Delivery y retiro" onPress={() => router.push('/vendedor/delivery')} last />
      </Card>

      <Card padded={false}>
        <MenuItem icon={Wallet} label="Finanzas" detail="Saldo, movimientos, faltas y liquidaciones" onPress={() => router.push('/vendedor/finanzas')} />
        {business.tier === 'informal' && (
          <MenuItem icon={TrendingUp} label="Pasar a Negocio formal" detail="Sube tus límites con RUC y matrícula" onPress={() => router.push('/vendedor/formalizar')} />
        )}
        <MenuItem icon={Bell} label="Notificaciones" badge={unread} onPress={() => router.push('/notificaciones')} />
        <MenuItem icon={UserRound} label="Mi perfil" onPress={() => router.push('/vendedor/perfil')} last />
      </Card>

      <Button variant="ghost" icon={LogOut} onPress={signOut}>
        Cerrar sesión
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  head: { overflow: 'hidden' },
  cover: { height: 96, backgroundColor: colors.niebla, overflow: 'hidden' },
  headBody: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: -30, alignItems: 'flex-end' },
  logo: { width: 72, height: 72, borderRadius: 18, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.niebla, overflow: 'hidden' },
  view: { alignSelf: 'flex-start', margin: 16, marginTop: 12 },
  radius: { borderRadius: radius.md },
});
