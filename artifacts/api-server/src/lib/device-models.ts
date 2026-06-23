export interface KnownDevice {
  brand: string;
  model: string;
  chipset: string;
  androidVersion: string;
  bootloaderStatus: "locked" | "unlocked" | "unknown";
  imeiPrefix: string;
  adbIdentifier: string; // substring that ADB "model" field might contain
}

export const KNOWN_DEVICES: KnownDevice[] = [
  // Tecno Spark 40 series
  {
    brand: "Tecno", model: "SPARK 40 KM5", chipset: "Helio G91",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "SPARK_40",
  },
  {
    brand: "Tecno", model: "SPARK 40 Pro+ KM8", chipset: "Helio G100",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "SPARK_40_Pro",
  },
  // Tecno Spark 30 series
  {
    brand: "Tecno", model: "SPARK 30C KJ5", chipset: "Helio G85",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "SPARK_30C",
  },
  {
    brand: "Tecno", model: "SPARK 30 Pro KJ7", chipset: "Helio G100",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "SPARK_30",
  },
  // Tecno Spark 20 series
  {
    brand: "Tecno", model: "SPARK 20 Pro+ KJ8", chipset: "Helio G85",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "SPARK_20",
  },
  // Tecno Camon series
  {
    brand: "Tecno", model: "CAMON 30 CL7", chipset: "Helio G91",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "CAMON_30",
  },
  {
    brand: "Tecno", model: "CAMON 30 Premier 5G CL9", chipset: "Dimensity 8050",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "CAMON_30_5G",
  },
  // Tecno Phantom
  {
    brand: "Tecno", model: "PHANTOM X2 Pro AD10", chipset: "Dimensity 9000",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "354", adbIdentifier: "PHANTOM_X2",
  },
  // Infinix
  {
    brand: "Infinix", model: "HOT 40i X6528B", chipset: "Helio G85",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "356", adbIdentifier: "HOT_40",
  },
  {
    brand: "Infinix", model: "NOTE 40 Pro X6850", chipset: "Helio G99",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "356", adbIdentifier: "NOTE_40",
  },
  {
    brand: "Infinix", model: "ZERO 40 5G X6960B", chipset: "Dimensity 8200",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "356", adbIdentifier: "ZERO_40",
  },
  // Samsung
  {
    brand: "Samsung", model: "Galaxy A55 5G", chipset: "Exynos 1480",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "352", adbIdentifier: "SM-A556",
  },
  {
    brand: "Samsung", model: "Galaxy A35 5G", chipset: "Exynos 1380",
    androidVersion: "14", bootloaderStatus: "locked",
    imeiPrefix: "352", adbIdentifier: "SM-A356",
  },
  {
    brand: "Samsung", model: "Galaxy A54 5G", chipset: "Exynos 1380",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "352", adbIdentifier: "SM-A546",
  },
  // Xiaomi
  {
    brand: "Xiaomi", model: "Redmi Note 13 Pro", chipset: "Snapdragon 7s Gen 2",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "860", adbIdentifier: "redmi_note13_pro",
  },
  {
    brand: "Xiaomi", model: "Redmi 13C", chipset: "Helio G85",
    androidVersion: "13", bootloaderStatus: "locked",
    imeiPrefix: "860", adbIdentifier: "redmi13c",
  },
];

export function lookupByAdbModel(adbModel: string): KnownDevice | undefined {
  const normalized = adbModel.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return KNOWN_DEVICES.find(d =>
    normalized.includes(d.adbIdentifier.toLowerCase().replace(/[^a-z0-9]/g, "_"))
    || d.adbIdentifier.toLowerCase().replace(/[^a-z0-9]/g, "_").includes(normalized)
  );
}

export function generateImei(prefix: string): string {
  const digits = prefix + Math.floor(Math.random() * 1e10).toString().padStart(10, "0");
  return digits.slice(0, 14) + computeLuhn(digits.slice(0, 14));
}

function computeLuhn(partial: string): number {
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    let d = parseInt(partial[partial.length - 1 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}
