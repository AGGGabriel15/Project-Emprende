import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bell, FileText, LogOut, MapPin, Shield, Store, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Logo } from '~/components/brand/logo';
import { PatternBackground } from '~/components/brand/pattern';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Avatar } from '~/components/ui/feedback';
import { MenuItem } from '~/components/ui/menu';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useNotifications } from '~/features/account/notifications';
import { useSession } from '~/features/auth/session';
import { WEB_URL } from '~/lib/api';

export default function AccountScreen() {
  const router = useRouter();
  const { session, profile, signOut } = useSession();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Screen edges={['top']}>
      {session && profile ? (
        <Card style={styles.profile} padded={false}>
          <PatternBackground variant="light" tile={72} />
          <View style={styles.profileContent}>
            <Avatar uri={profile.avatar_url} name={profile.full_name} size={64} />
            <View style={styles.flex}>
              <Text variant="heading">{profile.full_name || 'Tu cuenta'}</Text>
              <Text variant="small" tone="muted">
                {profile.email}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={styles.guest}>
          <Logo height={40} />
          <Text variant="body" tone="muted">
            Entra para comprar, seguir tus pedidos y guardar tus direcciones.
          </Text>
          <View style={styles.row}>
            <Button onPress={() => router.push('/login')} style={styles.flex} block>
              Entrar
            </Button>
            <Button variant="outline" onPress={() => router.push('/registro')} style={styles.flex} block>
              Crear cuenta
            </Button>
          </View>
        </Card>
      )}

      {session && (
        <Card padded={false}>
          <MenuItem icon={UserRound} label="Mi perfil" onPress={() => router.push('/perfil')} />
          <MenuItem icon={MapPin} label="Mis direcciones" onPress={() => router.push('/direcciones')} />
          <MenuItem icon={Bell} label="Notificaciones" badge={unread} onPress={() => router.push('/notificaciones')} last />
        </Card>
      )}

      <Card padded={false}>
        <MenuItem icon={Store} label="Vender en Catarina Market" onPress={() => router.push('/vendedor/solicitud')} />
        <MenuItem icon={FileText} label="Términos y condiciones" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)} />
        <MenuItem icon={Shield} label="Aviso de privacidad" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacidad`)} last />
      </Card>

      {session && (
        <Button variant="ghost" icon={LogOut} onPress={signOut}>
          Cerrar sesión
        </Button>
      )}
      <Text variant="small" tone="muted" style={styles.center}>
        Catarina Market · Catarina, Masaya, Nicaragua
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  profile: { overflow: 'hidden' },
  profileContent: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, zIndex: 1 },
  guest: { gap: 14, alignItems: 'flex-start' },
});
