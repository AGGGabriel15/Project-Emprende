import { formatPhone } from '@/lib/phone';
import { Input } from './input';

/**
 * Teléfono: sin prefijo se asume Nicaragua (+505), igual que phoneSchema del
 * web, que lo guarda en E.164. Muestra el número guardado ya formateado.
 */
export function PhoneInput({
  label = 'Teléfono / WhatsApp',
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      onBlur={() => {
        const formatted = formatPhone(value);
        if (formatted) onChange(formatted);
      }}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      placeholder="8888 8888"
      hint="Si es de otro país, inclúyelo con + y el código."
      error={error}
    />
  );
}
