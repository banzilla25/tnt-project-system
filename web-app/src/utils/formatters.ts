export function formatAbbreviated(num: number | null | undefined, isCurrency: boolean = false): string {
  if (num === null || num === undefined) return '-';
  
  let formatted = '';
  const absNum = Math.abs(num);

  // Gunakan 'en-US' karena user memberi contoh 55.54JT dan 234.56RB (dengan titik desimal)
  if (absNum >= 1_000_000_000) {
    const val = (num / 1_000_000_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'Mlyr';
  } else if (absNum >= 1_000_000) {
    const val = (num / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'JT';
  } else if (absNum >= 1_000) {
    const val = (num / 1_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'RB';
  } else {
    // Kalau dibawah ribuan tulis full (bisa pakai separator ribuan juga kalau ada)
    formatted = num.toLocaleString('id-ID'); // Tetap pakai id-ID untuk separator ribuan di angka penuh jika diperlukan
  }

  if (isCurrency) {
    return `Rp ${formatted}`;
  }
  return formatted;
}
