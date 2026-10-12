/**
 * Voxia Automation - GitHub Actions (gratis, sin Blaze)
 * 
 * 1. Sincroniza guías pendientes → ElevenLabs
 * 2. Extrae pedidos de conversaciones recientes → Firestore
 * 
 * Se ejecuta cada 15 minutos.
 * 
 * Secrets requeridos en GitHub:
 * - FIREBASE_SERVICE_ACCOUNT: JSON de la cuenta de servicio de Firebase
 * - ELEVENLABS_API_KEY: API key maestra de ElevenLabs
 */
const admin = require('firebase-admin');

// Extrae información de pedido del transcript de una conversación
// VERSIÓN CONSERVADORA: solo crea pedido si hay confirmación explícita
function extractOrderFromTranscript(transcript, agentId) {
  if (!transcript) return null;
  const text = transcript.toLowerCase();
  
  // Detectar si se tomó un pedido
  const orderKeywords = ['pedido', 'orden', 'quiero pedir', 'voy a querer', 'me trae', 'para llevar', 'domicilio'];
  const hasOrder = orderKeywords.some(k => text.includes(k));
  if (!hasOrder) return null;
  
  // REQUERIR confirmación explícita del pedido (no solo mención de precios)
  const confirmKeywords = ['confirmado', 'confirmo', 'listo el pedido', 'queda registrado', 'anotado', 'total sería', 'su total es', 'van a ser'];
  const hasConfirmation = confirmKeywords.some(k => text.includes(k));
  if (!hasConfirmation) {
    console.log(`⚠️ Posible pedido sin confirmación explícita, se omite (agent ${agentId})`);
    return null;
  }
  
  // Extraer total (buscar patrones como $18.99, 18.99, total 25)
  let total = 0;
  const moneyMatches = text.match(/\$?\s*(\d+[.,]\d{2})/g);
  if (moneyMatches) {
    // Tomar el último monto mencionado (suele ser el total)
    const last = moneyMatches[moneyMatches.length - 1].replace(/[$\s]/g, '').replace(',', '.');
    total = parseFloat(last) || 0;
  }
  
  // Extraer nombre del cliente (patrones comunes)
  let customer = 'Cliente por teléfono';
  const nameMatch = text.match(/(?:mi nombre es|me llamo|soy)\s+([a-záéíóúñ\s]+)/i);
  if (nameMatch) customer = nameMatch[1].trim().split(' ').slice(0, 2).join(' ');
  
  if (total <= 0) return null; // Sin total no es un pedido válido
  
  return { customer, total, detail: 'Pedido por llamada (auto)', status: 'completed', source: 'elevenlabs' };
}

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

  // DETECCIÓN DE AGENTES DUPLICADOS (ANTES de procesar nada)
  const agentToClient = {};
  const duplicateAgents = new Set();
  clientsSnap.forEach(d => {
    const aid = d.data().elevenlabsAgentId;
    if (aid) {
      if (agentToClient[aid]) {
        duplicateAgents.add(aid);
        console.error(`🚨 AGENTE DUPLICADO: ${aid} en ${agentToClient[aid]} y ${d.id}. Ambos se omitirán.`);
      } else {
        agentToClient[aid] = d.id;
      }
    }
  });

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

      // BLOQUEAR si el agente está duplicado
      if (duplicateAgents.has(agentId)) {
        console.error(`🚨 ${clientId}: agente ${agentId} duplicado, sincronización BLOQUEADA`);
        errors++;
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
        console.error(`❌ ${clientId}: ElevenLabs error ${response.status}`);
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

      console.log(`✅ ${clientId}: sincronizado`);
      synced++;

    } catch (e) {
      console.error(`❌ ${clientId}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Guías: ${synced} sincronizados, ${errors} errores, ${skipped} omitidos`);

  // ===== PARTE 2: Extraer pedidos de conversaciones recientes =====
  console.log('\n📞 Buscando pedidos en conversaciones recientes...');
  let ordersFound = 0;
  
  try {
    // Obtener agentes y sus conversaciones recientes
    const agentsRes = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      headers: { 'xi-api-key': elevenlabsKey }
    });
    
    if (agentsRes.ok) {
      const agentsData = await agentsRes.json();
      const agents = agentsData.agents || [];
      
      // Usar el mapa agentToClient ya construido (con duplicados detectados)
      // Los agentes duplicados ya fueron reportados y se omiten
      
      for (const agent of agents) {
        const clientId = agentToClient[agent.agent_id];
        if (!clientId) continue;
        // Omitir agentes duplicados
        if (duplicateAgents.has(agent.agent_id)) continue;
        
        // Obtener conversaciones recientes (últimas 24h)
        const convosRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agent.agent_id}&page_size=20`,
          { headers: { 'xi-api-key': elevenlabsKey } }
        );
        if (!convosRes.ok) continue;
        
        const convosData = await convosRes.json();
        const conversations = convosData.conversations || [];
        
        // Filtrar por últimas 24 horas
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        const recentConversations = conversations.filter(c => {
          const convoTime = new Date(c.start_time || c.created_at).getTime();
          return convoTime >= twentyFourHoursAgo;
        });
        
        for (const convo of recentConversations) {
          // Verificar si ya procesamos esta conversación
          const existing = await db.collection('clients').doc(clientId)
            .collection('orders')
            .where('conversationId', '==', convo.conversation_id)
            .limit(1).get();
          if (!existing.empty) continue;
          
          // Obtener transcript completo
          const detailRes = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${convo.conversation_id}`,
            { headers: { 'xi-api-key': elevenlabsKey } }
          );
          if (!detailRes.ok) continue;
          
          const detail = await detailRes.json();
          const transcript = (detail.transcript || [])
            .map(t => `${t.role}: ${t.message}`).join('\n');
          
          const order = extractOrderFromTranscript(transcript, agent.agent_id);
          if (order) {
            await db.collection('clients').doc(clientId).collection('orders').add({
              ...order,
              conversationId: convo.conversation_id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: 'sistema (auto)'
            });
            console.log(`🛒 Pedido auto registrado (${clientId})`);
            ordersFound++;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error extrayendo pedidos:', e.message);
  }
  
  console.log(`\n📊 Pedidos auto: ${ordersFound} encontrados`);
  console.log('\n✅ Proceso completado');
  if (errors > 0) process.exit(1);
}

main().catch(e => { console.error('💥 Error fatal:', e); process.exit(1); });
