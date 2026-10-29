import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type Bucket = 'product-images' | 'business-media' | 'business-documents' | 'avatars' | 'delivery-evidence';

/**
 * Toma una foto (cámara) o la elige de la galería. null si la persona cancela
 * o no da permiso; `error` explica por qué.
 */
export async function pickImage(source: 'camera' | 'library', options: { square?: boolean } = {}) {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { uri: null, error: source === 'camera' ? 'Activa el permiso de cámara en Ajustes.' : 'Activa el permiso de fotos en Ajustes.' };
  }
  const settings: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: options.square,
    aspect: options.square ? [1, 1] : undefined,
  };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(settings) : await ImagePicker.launchImageLibraryAsync(settings);
  if (result.canceled || !result.assets[0]) return { uri: null, error: null };
  return { uri: result.assets[0].uri, error: null };
}

/** Reduce la foto (lado mayor `max` px, JPEG) para subir rápido con datos móviles. */
async function downscale(uri: string, max: number) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: max });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Sube a <bucket>/<user_id>/<carpeta>/<uuid>.jpg, igual que el web (las
 * políticas de Storage exigen la carpeta del usuario).
 */
export async function uploadImage(uri: string, bucket: Bucket, folder: string, max = 1600) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Inicia sesión de nuevo.');
  const small = await downscale(uri, max);
  const body = await (await fetch(small)).arrayBuffer();
  const path = `${user.id}/${folder}/${randomId()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error('No pudimos subir la foto. Revisa tu conexión.');
  const publicUrl = bucket === 'business-documents' || bucket === 'delivery-evidence' ? null : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
