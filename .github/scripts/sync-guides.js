/**
 * Sincroniza las guías pendientes de Firestore con ElevenLabs.
 * Se ejecuta cada 15 minutos vía GitHub Actions (gratis).
 * 
 * Secrets requeridos en GitHub:
 * - FIREBASE_SERVICE_ACCOUNT: JSON de la cuenta de servicio de Firebase
 * - ELEVENLABS_API_KEY: API key maestra de ElevenLabs (para clientes Voxia Completo)
 */
const admin = require('firebase-admin');

async function main() {
  console.log('🔄 Iniciando sincronización de guías...');
  
  // Inicializar Firebase Admin
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  
  const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenlabsKey) {
    console.error('❌ Falta ELEVENLABS_API_KEY');
    process.exit(1);
  }

  // Buscar clientes con guías pendientes de sincronizar
  const clientsSnap = await db.collection('clients').get();
  let synced = 0, errors = 0, skipped = 0;

  for (const clientDoc of clientsSnap.docs) {
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    
    try {
      const configDoc = await db.collection('clients').doc(clientId)
        .collection('config').doc('settings').get();
      const config = configDoc.data();
      
      if (!config?.guide?.pendingSync) { skipped++; continue; }
      
      const guide = config.guide;
      const agentId = clientData.elevenlabsAgentId;
      
      if (!agentId) {
        console.log(`⚠️ ${clientId}: sin agent ID, omitiendo`);
        skipped++;
        continue;
      }

      // Determinar qué API key usar
      let apiKey = elevenlabsKey;
      if (clientData.billingModel === 'maintenance' && clientData.ownElevenlabsKey) {
        // TODO: desencriptar la key del cliente
        console.log(`⚠️ ${clientId}: tiene keys propias, requiere desencriptado`);
        skipped++;
        continue;
      }

      // Construir prompt
      const prompt = [
        `Eres el asistente de ${clientData.name || 'este negocio'}.`,
        '',
        'INFORMACIÓN DEL NEGOCIO:',
        guide.desc || '',
        '',
        `HORARIO: ${guide.hours || 'No especificado'}`,
        `DIRECCIÓN: ${guide.address || 'No especificada'}`,
        '',
        'MENÚ/SERVICIOS:',
        guide.menu || '',
        '',
        'NOTAS IMPORTANTES:',
        guide.notes || '',
        '',
        'Responde siempre en base a esta información. Sé amable y profesional.',
        'Si te preguntan algo fuera de esta información, indica que no tienes ese dato.'
      ].join('\n');

      // Actualizar agente en ElevenLabs
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
        {
          method: 'PATCH',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversation_config: {
              agent: {
                prompt: { prompt },
                first_message: `Hola, gracias por llamar a ${clientData.name}. ¿En qué puedo ayudarle?`
              }
            }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ ${clientId}: ElevenLabs error ${response.status}: ${errText.substring(0, 200)}`);
        errors++;
        continue;
      }

      // Marcar como sincronizado
      await db.collection('clients').doc(clientId)
        .collection('config').doc('settings').set({
          'guide.pendingSync': false,
          'guide.syncedAt': admin.firestore.FieldValue.serverTimestamp(),
          'guide.lastSyncOk': true
        }, { merge: true });

      console.log(`✅ ${clientId} (${clientData.name}): sincronizado`);
      synced++;

    } catch (e) {
      console.error(`❌ ${clientId}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Resumen: ${synced} sincronizados, ${errors} errores, ${skipped} omitidos`);
  if (errors > 0) process.exit(1);
}

main().catch(e => { console.error('💥 Error fatal:', e); process.exit(1); });
