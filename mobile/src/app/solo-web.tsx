import * as WebBrowser from 'expo-web-browser';
import { MonitorSmartphone } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AuthShell } from '~/components/auth/auth-shell';
import { Button } from '~/components/ui/button';
import { EmptyState } from '~/components/ui/feedback';
import { useSession } from '~/features/auth/session';
import { WEB_URL } from '~/lib/api';

/** La administración se hace solo desde el web. */
export default function AdminOnlyWeb() {
  const { signOut } = useSession();
  return (
    <AuthShell title="Panel de administración">
      <EmptyState
        icon={MonitorSmartphone}
        title="Usa el panel web"
        description="Esta app es para clientes, vendedores y repartidores. La administración de Catarina Market se hace desde el web."
        action={
          <View style={styles.actions}>
            <Button onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin/dashboard`)} block>
              Abrir el panel web
            </Button>
            <Button variant="outline" onPress={signOut} block>
              Cerrar sesión
            </Button>
          </View>
        }
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({ actions: { gap: 10, alignSelf: 'stretch' } });
