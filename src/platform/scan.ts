/* Barcode scanning on Android: the Google code scanner (ML Kit, on the phone, no image leaves it). In a browser there is no scanner,
   the person types the code. The plugin is imported only on the phone. */
import { isNative } from './files';

export type ScanResult = { kind: 'code'; code: string } | { kind: 'cancel' } | { kind: 'unavailable'; detail: string };
export async function scanBarcode(): Promise<ScanResult> {
  if (!isNative()) return { kind: 'unavailable', detail: 'web' };
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
    const sup = await BarcodeScanner.isSupported().catch(() => ({ supported: false }));
    if (!sup.supported) return { kind: 'unavailable', detail: 'unsupported' };
    const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: false }));
    if (!mod.available) {
      // the first use downloads the scanner module through Google Play services; the person can type the code meanwhile
      await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => undefined);
      return { kind: 'unavailable', detail: 'installing' };
    }
    const r = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] });
    const code = r.barcodes[0]?.rawValue ?? '';
    return code ? { kind: 'code', code } : { kind: 'cancel' };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return /cancel/i.test(m) ? { kind: 'cancel' } : { kind: 'unavailable', detail: m };
  }
}
