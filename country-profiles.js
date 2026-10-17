/* ============================================================
   COUNTRY PROFILES — única fuente de verdad por país (Voxia)
   ------------------------------------------------------------
   REGLA DURA (orden de amo Jeremy Rico, 2026-10-16):
   el PAÍS del cliente decide TODO automáticamente. Voz, tarifas
   de WhatsApp, moneda, planes, instalación y facturación se
   DERIVAN del país. Nada se configura por separado, nada se
   mezcla: país Colombia => todo Colombia; país EE.UU. => todo EE.UU.

   Para agregar un país nuevo, se agrega UNA entrada aquí y todo
   el panel la adopta solo. Prohibido poner `country==='XX'`
   regado por el código: usar countryProfile(code).
   ============================================================ */
const COUNTRY_PROFILES = {
  US: {
    code: 'US',
    name: 'Estados Unidos',
    dial: '+1',
    curr: 'USD',
    voiceEngine: 'elevenlabs',
    voiceLabel: 'ElevenLabs · voz premium',
    waRates: { marketing: 0.0250, utility: 0.0034, authentication: 0.0034, service: 0.0034 },
    plans: ['Básico', 'Pro', 'Premium'],
    monthlyFull: 400, monthlyMaint: 100,          // USD/mes
    install: { 'Básico': 700, 'Pro': 750, 'Premium': 800 }, // USD una vez
    billingDefault: 'full',
    billNote: {
      full: '🇺🇸 Voxia lo incluye en tu factura.',
      maintenance: '🇺🇸 Se cobra en tus cuentas.'
    }
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    dial: '+57',
    curr: 'COP',
    voiceEngine: 'vox-zero',
    voiceLabel: 'Vox Cero · voz $0 (whisper + Piper)',
    waRates: { marketing: 0.0125, utility: 0.0008, authentication: 0.0008, service: 0.0008 },
    plans: ['Básico', 'Pro'],
    monthlyFull: 100000, monthlyMaint: 100000,    // COP/mes (Colombia: solo mantenimiento)
    install: { 'Básico': 1500000, 'Pro': 1650000 }, // COP una vez
    billingDefault: 'maintenance',
    billNote: {
      full: '🇨🇴 Voxia lo incluye en tu factura.',
      maintenance: '🇨🇴 Se cobra en tu cuenta de Meta (Voxia no toca cobranza).'
    }
  }
};
// "Otro": adopta el perfil US (voz premium, USD). Cambiar aquí si se define otro.
COUNTRY_PROFILES.OT = Object.assign({}, COUNTRY_PROFILES.US, { code: 'OT', name: 'Otro' });

/* Perfil del país. Siempre devuelve un perfil válido. */
function countryProfile(code) {
  return COUNTRY_PROFILES[code] || COUNTRY_PROFILES.OT;
}
/* Motor de voz DERIVADO del país. Esta es la única vía legítima
   para saber qué voz usa un cliente: nunca se guarda a mano. */
function voiceEngineFor(code) {
  return countryProfile(code).voiceEngine;
}
function voiceLabelFor(code) {
  return countryProfile(code).voiceLabel;
}
