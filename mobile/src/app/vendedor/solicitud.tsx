import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Home, Hourglass, LocateFixed, MapPin, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  recordDocumentWith,
  saveBankStepWith,
  saveLegalStepWith,
  saveStoreStepWith,
  submitApplicationWith,
} from '@/features/businesses/mutations';
import { formatDate, formatPercent } from '@/lib/format';
import { mapsUrl } from '@/lib/maps';
import { formatPhone } from '@/lib/phone';
import { BANKS, REQUIRED_DOCUMENTS, TIER_INFO } from '@/lib/validations/business';
import type { Business, BusinessTier, DocumentType } from '@/types/domain';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Input } from '~/components/ui/input';
import { Screen } from '~/components/ui/screen';
import { Select } from '~/components/ui/select';
import { Text } from '~/components/ui/text';
import { toast } from '~/components/ui/toast';
import { DocumentField } from '~/components/vendor/media-fields';
import { StoreFields, type StoreValues } from '~/components/vendor/store-fields';
import { useSession } from '~/features/auth/session';
import { ACCOUNT_TYPES, CURRENCIES, PERSON_TYPES, TAX_REGIMES } from '~/features/vendor/options';
import { actionFieldErrors, isActiveBusiness, useApplication, useMyBusiness, useVendorAction } from '~/features/vendor/queries';
import { WEB_URL } from '~/lib/api';
import { currentPosition } from '~/lib/position';
import { colors, radius } from '~/theme/tokens';

const STEPS = ['Tipo y datos', 'Documentos', 'Tu local', 'Cuenta bancaria', 'Enviar'];

/** Solicitud del negocio en 5 pasos (como ApplicationWizard del web); guarda en cada paso. */
export default function ApplicationScreen() {
  const router = useRouter();
  const business = useMyBusiness();
  const application = useApplication(business.data?.id);
  const b = business.data;

  if (business.isLoading || application.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Registra tu negocio' }} />
        <Skeleton height={300} />
      </Screen>
    );
  }
  if (b?.status === 'pending') {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tu solicitud' }} />
        <EmptyState
          icon={Hourglass}
          title="Tu solicitud está en revisión"
          description={`Enviada el ${b.submitted_at ? formatDate(b.submitted_at) : '—'}. Te avisaremos por correo y en tus notificaciones.`}
          action={<Button variant="outline" onPress={() => router.replace('/')}>Volver a la tienda</Button>}
        />
      </Screen>
    );
  }
  if (isActiveBusiness(b)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tu negocio' }} />
        <EmptyState
          icon={CheckCircle2}
          title="Tu negocio está aprobado"
          description="Ya puedes publicar productos y recibir pedidos."
          action={<Button onPress={() => router.replace('/vendedor/panel')}>Ir al panel</Button>}
        />
      </Screen>
    );
  }
  return <Wizard business={b ?? null} />;
}

function Wizard({ business }: { business: Business | null }) {
  const { profile } = useSession();
  const application = useApplication(business?.id).data!;
  const tier: BusinessTier = business?.tier ?? 'informal';
  const uploaded = new Set(application.documents.map((d) => d.doc_type));
  const done = [
    !!business,
    !!business && REQUIRED_DOCUMENTS[tier].every((d) => uploaded.has(d.type)),
    !!business?.category_id && !!business.address_line && (tier !== 'informal' || application.location?.latitude != null),
    !!application.bank,
  ];
  const [step, setStep] = useState(() => {
    const first = done.findIndex((d) => !d);
    return first === -1 ? 4 : first;
  });
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withSpring((step + 1) / STEPS.length, { damping: 18 }));
  }, [step, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const go = (next: number) => setStep(Math.max(0, Math.min(4, next)));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Registra tu negocio' }} />
      <Text variant="small" tone="muted">
        Completa los 5 pasos. Puedes vender aunque no tengas RUC: guardamos tu avance en cada paso.
      </Text>
      {business?.status === 'rejected' && (
        <Card style={styles.rejected}>
          <Text variant="bodyMedium" tone="danger">
            La solicitud fue rechazada
          </Text>
          <Text variant="small">Motivo: {business.rejection_reason}</Text>
          <Text variant="small" tone="muted">
            Corrige lo indicado y vuelve a enviarla.
          </Text>
        </Card>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, bar]} />
      </View>
      <View style={styles.steps}>
        {STEPS.map((label, i) => (
          <Pressable key={label} onPress={() => (i === 0 || business) && go(i)} style={styles.stepDot}>
            <View style={[styles.dot, i === step && styles.dotActive, done[i] && i !== step && styles.dotDone]}>
              {done[i] && i !== step ? <Check size={12} color={colors.white} strokeWidth={3} /> : <Text style={[styles.dotText, i === step && styles.dotTextActive]}>{i + 1}</Text>}
            </View>
          </Pressable>
        ))}
      </View>
      <Text variant="heading">
        {step + 1}. {STEPS[step]}
      </Text>
      <Animated.View key={step} entering={FadeInRight.springify().damping(18)} style={styles.gap}>
        {step === 0 && <LegalStep business={business} ownerName={profile?.full_name ?? ''} onSaved={() => go(1)} />}
        {step === 1 && business && <DocumentsStep tier={tier} uploaded={uploaded} onBack={() => go(0)} onNext={() => go(2)} />}
        {step === 2 && business && <StoreStep business={business} location={application.location} onBack={() => go(1)} onSaved={() => go(3)} />}
        {step === 3 && business && <BankStep onBack={() => go(2)} onSaved={() => go(4)} />}
        {step === 4 && business && (
          <SubmitStep
            tier={tier}
            missing={STEPS.slice(0, 4).filter((_, i) => !done[i])}
            commissionRate={application.commissionRate}
            onBack={() => go(3)}
          />
        )}
      </Animated.View>
    </Screen>
  );
}

function Nav({ onBack, onNext, nextLabel = 'Guardar y seguir', loading, disabled }: { onBack?: () => void; onNext: () => void; nextLabel?: string; loading?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.nav}>
      {onBack ? (
        <Button variant="ghost" icon={ChevronLeft} onPress={onBack}>
          Atrás
        </Button>
      ) : (
        <View />
      )}
      <Button iconRight={ChevronRight} onPress={onNext} loading={loading} disabled={disabled}>
        {nextLabel}
      </Button>
    </View>
  );
}

function LegalStep({ business, ownerName, onSaved }: { business: Business | null; ownerName: string; onSaved: () => void }) {
  const save = useVendorAction(saveLegalStepWith, { invalidate: ['my-business', 'application'] });
  const [form, setForm] = useState({
    tier: (business?.tier ?? 'informal') as BusinessTier,
    tradeName: business?.trade_name ?? '',
    legalName: business?.legal_name ?? ownerName,
    personType: (business?.person_type ?? null) as 'natural' | 'juridica' | null,
    ruc: business?.ruc ?? '',
    taxRegime: (business?.tax_regime ?? null) as 'cuota_fija' | 'regimen_general' | null,
    municipalLicense: business?.municipal_license ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <>
      <Text variant="small" tone="muted">
        ¿Cómo vendes? Ambos pagan la misma comisión. El negocio formal tiene límites de venta más altos.
      </Text>
      {(['informal', 'formal'] as const).map((option) => {
        const active = form.tier === option;
        const Icon = option === 'informal' ? Home : BadgeCheck;
        return (
          <Pressable key={option} onPress={() => set({ tier: option })} style={[styles.tier, active && styles.tierActive]}>
            <Icon size={22} color={active ? colors.catarina : colors.mutedForeground} />
            <View style={styles.flex}>
              <Text variant="bodyMedium">{TIER_INFO[option].label}</Text>
              <Text variant="small" tone="muted">
                {TIER_INFO[option].short}
              </Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>{active && <Check size={12} color={colors.white} strokeWidth={3} />}</View>
          </Pressable>
        );
      })}
      <Card style={styles.gap}>
        <Input label="Nombre del negocio" hint="Así te verán los clientes." value={form.tradeName} onChangeText={(tradeName) => set({ tradeName })} error={errors.tradeName} />
        <Input
          label={form.tier === 'formal' ? 'Razón social / propietario' : 'Tu nombre completo (como en la cédula)'}
          value={form.legalName}
          onChangeText={(legalName) => set({ legalName })}
          error={errors.legalName}
        />
        {form.tier === 'formal' && (
          <>
            <Select label="Tipo de persona" value={form.personType} options={PERSON_TYPES} onChange={(personType) => set({ personType })} error={errors.personType} />
            <Input label="RUC (DGI)" autoCapitalize="characters" value={form.ruc} onChangeText={(ruc) => set({ ruc })} error={errors.ruc} />
            <Select label="Régimen fiscal" value={form.taxRegime} options={TAX_REGIMES} onChange={(taxRegime) => set({ taxRegime })} error={errors.taxRegime} />
            <Input label="Matrícula de la Alcaldía" value={form.municipalLicense} onChangeText={(municipalLicense) => set({ municipalLicense })} error={errors.municipalLicense} />
          </>
        )}
        {form.tier === 'informal' && (
          <Text variant="small" tone="muted">
            Te pediremos una selfie con tu cédula, fotos del lugar y la ubicación GPS. La administración visita tu local antes de aprobarte.
          </Text>
        )}
      </Card>
      <Nav
        loading={save.isPending}
        onNext={() => save.mutate([form], { onSuccess: () => { setErrors({}); onSaved(); }, onError: (e) => setErrors(actionFieldErrors(e)) })}
      />
    </>
  );
}

function DocumentsStep({ tier, uploaded, onBack, onNext }: { tier: BusinessTier; uploaded: Set<DocumentType>; onBack: () => void; onNext: () => void }) {
  const record = useVendorAction(recordDocumentWith, { success: 'Documento recibido.', invalidate: ['application'] });
  const docs = REQUIRED_DOCUMENTS[tier];
  return (
    <>
      <Text variant="small" tone="muted">
        Toma las fotos con buena luz. Solo la administración las ve.
      </Text>
      {docs.map((doc) => (
        <DocumentField
          key={doc.type}
          label={doc.label}
          hint={'hint' in doc ? doc.hint : undefined}
          uploaded={uploaded.has(doc.type)}
          onUploaded={async (path) => {
            await record.mutateAsync([{ docType: doc.type as DocumentType, filePath: path }]);
          }}
        />
      ))}
      <Nav onBack={onBack} onNext={onNext} nextLabel="Seguir" disabled={!docs.every((d) => uploaded.has(d.type))} />
    </>
  );
}

function StoreStep({
  business,
  location,
  onBack,
  onSaved,
}: {
  business: Business;
  location: { latitude: number | null; longitude: number | null } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const save = useVendorAction(saveStoreStepWith, { invalidate: ['my-business', 'application'] });
  const [store, setStore] = useState<StoreValues>({
    categoryId: business.category_id,
    description: business.description ?? '',
    departmentId: business.department_id,
    municipalityId: business.municipality_id,
    addressLine: business.address_line ?? '',
    phone: formatPhone(business.phone),
    whatsapp: formatPhone(business.whatsapp),
    logoUrl: business.logo_url ?? '',
    coverUrl: business.cover_url ?? '',
  });
  const [gps, setGps] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: location?.latitude != null ? Number(location.latitude) : null,
    longitude: location?.longitude != null ? Number(location.longitude) : null,
  });
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const informal = business.tier === 'informal';

  async function capture() {
    setLocating(true);
    const position = await currentPosition();
    setLocating(false);
    if (!position) return toast.error('Activa el permiso de ubicación y el GPS.');
    setGps({ latitude: position.lat, longitude: position.lng });
    toast.success('Ubicación guardada.');
  }

  function submit() {
    if (informal && gps.latitude == null) return toast.error('Guarda la ubicación GPS de tu local (estando en él).');
    save.mutate(
      [{ ...store, categoryId: store.categoryId ?? 0, departmentId: store.departmentId ?? 0, municipalityId: store.municipalityId ?? 0, ...gps }],
      { onSuccess: () => { setErrors({}); onSaved(); }, onError: (e) => setErrors(actionFieldErrors(e)) },
    );
  }

  return (
    <>
      <Card style={styles.gap}>
        <StoreFields values={store} onChange={(patch) => setStore((s) => ({ ...s, ...patch }))} errors={errors} />
      </Card>
      <Card style={styles.gap}>
        <Text variant="bodyMedium">Ubicación GPS del local{informal ? ' (obligatoria)' : ''}</Text>
        <Text variant="small" tone="muted">
          Hazlo estando en tu local. El repartidor la usa para llegar; los clientes no la ven.
        </Text>
        {gps.latitude != null && gps.longitude != null ? (
          <Pressable style={styles.gps} onPress={() => Linking.openURL(mapsUrl(gps.latitude!, gps.longitude!))}>
            <MapPin size={16} color={colors.catarina} />
            <Text variant="small" tone="primary">
              {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ver en el mapa
            </Text>
          </Pressable>
        ) : null}
        <Button variant="secondary" icon={LocateFixed} loading={locating} onPress={capture}>
          {gps.latitude != null ? 'Actualizar ubicación' : 'Estoy en mi local: guardar ubicación'}
        </Button>
      </Card>
      <Nav onBack={onBack} onNext={submit} loading={save.isPending} />
    </>
  );
}

function BankStep({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const business = useMyBusiness().data!;
  const { profile } = useSession();
  const bank = useApplication(business.id).data?.bank;
  const save = useVendorAction(saveBankStepWith, { invalidate: ['application'] });
  const [form, setForm] = useState({
    bankName: bank?.bank_name ?? null,
    accountType: (bank?.account_type ?? 'ahorro') as 'ahorro' | 'corriente',
    currency: (bank?.currency ?? 'NIO') as 'NIO' | 'USD',
    accountNumber: bank?.account_number ?? '',
    accountHolder: bank?.account_holder ?? business.legal_name ?? profile?.full_name ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <>
      <Text variant="small" tone="muted">
        Aquí te depositamos tus ventas. La cuenta debe estar a tu nombre o al del negocio.
      </Text>
      <Card style={styles.gap}>
        <Select label="Banco" value={form.bankName} options={BANKS.map((b) => ({ value: b, label: b }))} onChange={(bankName) => set({ bankName })} error={errors.bankName} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Select label="Tipo de cuenta" value={form.accountType} options={ACCOUNT_TYPES} onChange={(accountType) => set({ accountType })} />
          </View>
          <View style={styles.flex}>
            <Select label="Moneda" value={form.currency} options={CURRENCIES} onChange={(currency) => set({ currency })} />
          </View>
        </View>
        <Input label="Número de cuenta" keyboardType="number-pad" value={form.accountNumber} onChangeText={(accountNumber) => set({ accountNumber: accountNumber.replace(/\D/g, '') })} error={errors.accountNumber} />
        <Input label="Titular de la cuenta" value={form.accountHolder} onChangeText={(accountHolder) => set({ accountHolder })} error={errors.accountHolder} />
      </Card>
      <Nav
        onBack={onBack}
        loading={save.isPending}
        onNext={() => save.mutate([{ ...form, bankName: form.bankName ?? '' }], { onSuccess: () => { setErrors({}); onSaved(); }, onError: (e) => setErrors(actionFieldErrors(e)) })}
      />
    </>
  );
}

function SubmitStep({ tier, missing, commissionRate, onBack }: { tier: BusinessTier; missing: string[]; commissionRate: number; onBack: () => void }) {
  const submit = useVendorAction(submitApplicationWith, { success: '¡Solicitud enviada! Te avisaremos cuando sea revisada.', invalidate: ['my-business'] });
  const [terms, setTerms] = useState(false);
  const [commission, setCommission] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const ready = missing.length === 0;
  return (
    <>
      {!ready && (
        <Card style={styles.warning}>
          <Text variant="small">Te falta completar: {missing.join(', ')}.</Text>
        </Card>
      )}
      <Card style={styles.gap}>
        <Text variant="bodyMedium">Comisión vigente: {formatPercent(commissionRate)} por pedido</Text>
        <Text variant="small" tone="muted">
          Sin mensualidad ni inscripción. Se calcula sobre los productos. Catarina Market cobra el envío al cliente, envía a sus repartidores y te paga
          48 h después de la entrega. Ejemplo: en un pedido de C$ 1,000 en productos recibes C$ {(1000 - 1000 * commissionRate).toLocaleString('es-NI')}.
        </Text>
      </Card>
      <Checkbox checked={terms} onChange={setTerms}>
        Acepto los{' '}
        <Text variant="smallMedium" tone="primary" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)}>
          términos y condiciones
        </Text>{' '}
        para vendedores.
      </Checkbox>
      <Checkbox checked={commission} onChange={setCommission}>
        Acepto la comisión de {formatPercent(commissionRate)} por pedido.
      </Checkbox>
      <Checkbox checked={declaration} onChange={setDeclaration}>
        <Text variant="smallMedium">Declaración jurada: </Text>
        los datos y documentos son verdaderos; vendo productos propios o de procedencia legítima; acepto la inspección de cada pedido al recogerlo
        {tier === 'informal' ? ', la visita de verificación' : ''} y que Catarina Market retenga el pago hasta confirmar la entrega. Si incumplo, acepto faltas,
        suspensión y el descuento de reembolsos de mis liquidaciones.
      </Checkbox>
      <View style={styles.nav}>
        <Button variant="ghost" icon={ChevronLeft} onPress={onBack}>
          Atrás
        </Button>
        <Button icon={Send} disabled={!ready || !terms || !commission || !declaration} loading={submit.isPending} onPress={() => submit.mutate([commissionRate])}>
          Enviar solicitud
        </Button>
      </View>
    </>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={() => onChange(!checked)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
      <Text variant="small" style={styles.flex}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  rejected: { backgroundColor: colors.dangerSoft, borderColor: '#F2C4C1', gap: 4 },
  warning: { backgroundColor: colors.warningSoft, borderColor: '#F1D9A6' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.catarina },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  stepDot: { padding: 4 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dotActive: { borderColor: colors.catarina, backgroundColor: colors.niebla },
  dotDone: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  dotText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'DMSans_700Bold' },
  dotTextActive: { color: colors.catarina },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tierActive: { borderColor: colors.catarina, backgroundColor: colors.niebla },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.catarina, borderColor: colors.catarina },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.input, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.catarina, borderColor: colors.catarina },
});
