/**
 * Voxia Firebase Integration
 * Reemplaza localStorage con Firebase Auth + Firestore
 * 
 * Uso: incluir después de los SDK de Firebase en dashboard.html
 * 
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js"></script>
 * <script src="firebase-integration.js"></script>
 */

(function() {
  'use strict';

  // Configuración Firebase — proyecto voxia-49c2e
  // NOTA: estos valores son públicos por diseño (van en el frontend).
  // La seguridad está en las reglas Firestore, no en ocultar estas keys.
  const firebaseConfig = {
    apiKey: "AIzaSyBe5WbwVOsvO2rDXLyowLM6XP8F9j0Mrpw",
    authDomain: "voxia-49c2e.firebaseapp.com",
    projectId: "voxia-49c2e",
    storageBucket: "voxia-49c2e.firebasestorage.app",
    messagingSenderId: "285520796042",
    appId: "1:285520796042:web:ac8bd4080f344c6f439073"
  };

  // Inicializar
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const functions = firebase.functions();

  // Estado global
  const VoxiaDB = {
    user: null,
    userData: null,   // doc de users/{uid}
    clientId: null,
    clientData: null, // doc de clients/{clientId}
    db: db,           // Firestore expuesto para consultas
    auth: auth,       // Auth expuesto

    /**
     * Login con email/password
     */
    async login(email, password) {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      await this.loadUserData(cred.user.uid);
      await this.logActivity('login', {});
      return cred.user;
    },

    /**
     * Logout
     */
    async logout() {
      await this.logActivity('logout', {});
      await auth.signOut();
      this.user = null;
      this.userData = null;
      this.clientId = null;
      this.clientData = null;
    },

    /**
     * Carga datos del usuario y su cliente
     */
    async loadUserData(uid) {
      this.user = auth.currentUser;
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) throw new Error('Usuario no registrado en Voxia');
      this.userData = userDoc.data();
      this.clientId = this.userData.clientId;

      if (this.clientId) {
        const clientDoc = await db.collection('clients').doc(this.clientId).get();
        if (clientDoc.exists) this.clientData = clientDoc.data();
      }
    },

    /**
     * Obtiene la configuración del cliente (menú, horarios, voz)
     */
    async getClientConfig() {
      if (!this.clientId) return null;
      const snap = await db.collection('clients').doc(this.clientId)
        .collection('config').doc('settings').get();
      return snap.exists ? snap.data() : null;
    },

    /**
     * Guarda la configuración del cliente
     */
    async saveClientConfig(config) {
      if (!this.clientId) throw new Error('Sin cliente asignado');
      await db.collection('clients').doc(this.clientId)
        .collection('config').doc('settings').set(config, { merge: true });
      await this.logActivity('config_change', { fields: Object.keys(config) });
    },

    /**
     * Estado del agente ElevenLabs (vía Cloud Function, sin exponer key)
     */
    async getAgentStatus(agentId) {
      const fn = functions.httpsCallable('getAgentStatus');
      const result = await fn({ clientId: this.clientId, agentId });
      return result.data;
    },

    /**
     * Estado de Twilio (vía Cloud Function, sin exponer token)
     */
    async getTwilioStatus() {
      const fn = functions.httpsCallable('getTwilioStatus');
      const result = await fn({ clientId: this.clientId });
      return result.data;
    },

    /**
     * Plantillas por tipo de negocio.
     * Al crear un cliente, su asistente se configura automáticamente.
     */
    BIZ_TEMPLATES: {
      restaurante: {
        nombre: 'Restaurante', icono: '🍽️',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿Su pedido es para recoger o delivery?',
        servicios: ['Tomar pedidos', 'Confirmar dirección', 'Tiempos de entrega'],
        preguntas: ['¿Para recoger o delivery?', '¿Algo más?', '¿A nombre de quién?'],
        pickup: true, delivery: true, citas: false,
      },
      dental: {
        nombre: 'Clínica dental', icono: '🦷',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿Desea agendar una cita?',
        servicios: ['Agendar citas', 'Confirmar seguros', 'Recordatorios'],
        preguntas: ['¿Qué día prefiere?', '¿Es paciente nuevo?', '¿Tiene seguro dental?'],
        pickup: false, delivery: false, citas: true,
      },
      taller: {
        nombre: 'Taller mecánico', icono: '🔧',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿En qué le ayudamos con su vehículo?',
        servicios: ['Diagnósticos', 'Cotizar servicios', 'Agendar citas'],
        preguntas: ['¿Qué marca y modelo?', '¿Qué falla presenta?', '¿Cuándo puede traerlo?'],
        pickup: false, delivery: false, citas: true,
      },
      belleza: {
        nombre: 'Salón de belleza', icono: '💇',
        saludo: '¡Hola! Bienvenido a {negocio}. ¿Desea reservar un servicio?',
        servicios: ['Reservar servicios', 'Confirmar estilista', 'Promociones'],
        preguntas: ['¿Qué servicio desea?', '¿Con qué estilista?', '¿Qué día y hora?'],
        pickup: false, delivery: false, citas: true,
      },
      hotel: {
        nombre: 'Hotel', icono: '🏨',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿Desea hacer una reserva?',
        servicios: ['Reservas', 'Info check-in', 'Servicios 24/7'],
        preguntas: ['¿Para qué fechas?', '¿Cuántas personas?', '¿Tipo de habitación?'],
        pickup: false, delivery: false, citas: false,
      },
      abogado: {
        nombre: 'Abogado', icono: '⚖️',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿En qué caso le ayudamos?',
        servicios: ['Agendar consultas', 'Tomar datos del caso', 'Seguimiento'],
        preguntas: ['¿Qué tipo de caso?', '¿Desea agendar consulta?', '¿Su nombre y teléfono?'],
        pickup: false, delivery: false, citas: true,
      },
      veterinaria: {
        nombre: 'Veterinaria', icono: '🐾',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿Su mascota necesita atención?',
        servicios: ['Agendar citas', 'Emergencias', 'Recordatorios vacunas'],
        preguntas: ['¿Qué mascota es?', '¿Qué síntomas tiene?', '¿Es emergencia?'],
        pickup: false, delivery: false, citas: true,
      },
      inmobiliaria: {
        nombre: 'Inmobiliaria', icono: '🏠',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿Busca comprar, vender o rentar?',
        servicios: ['Agendar visitas', 'Info propiedades', 'Seguimiento'],
        preguntas: ['¿Compra, venta o renta?', '¿En qué zona?', '¿Presupuesto?'],
        pickup: false, delivery: false, citas: true,
      },
      otro: {
        nombre: 'Personalizado', icono: '📦',
        saludo: '¡Hola! Gracias por llamar a {negocio}. ¿En qué le ayudamos?',
        servicios: ['Atención general'],
        preguntas: ['¿En qué le ayudamos?'],
        pickup: false, delivery: false, citas: false,
        personalizable: true,
      },
    },
    PLANS: {
      basico: {
        nombre: 'Básico', precio: 149, minutos: 1000,
        idiomas: 2, idiomasLista: ['es', 'en'],
        menuIlimitado: true, ubicaciones: 1,
        whatsapp: false, gcalendar: false,
        soporte: 'prioritario',
      },
      pro: {
        nombre: 'Pro', precio: 249, minutos: 2000,
        idiomas: 2, idiomasLista: ['es', 'en'],
        menuIlimitado: true, ubicaciones: 1,
        whatsapp: true, gcalendar: false,
        soporte: 'prioritario',
      },
      premium: {
        nombre: 'Premium', precio: 399, minutos: 5000,
        idiomas: 3, idiomasLista: ['es', 'en', 'pt'],
        menuIlimitado: true, ubicaciones: 3,
        whatsapp: true, gcalendar: true,
        soporte: 'prioritario',
      },
    },

    /**
     * Onboarding completo de cliente nuevo (solo superadmin).
     * Crea usuario Auth + docs en Firestore, todo conectado.
     * Usa el SDK cliente (las reglas permiten a superadmin escribir todo).
     */
    // Función de prueba mínima para debug
    async testWrite() {
      try {
        const testId = 'test-' + Date.now();
        await db.collection('clients').doc(testId).set({
          name: 'Test',
          createdAt: firebase.firestore.Timestamp.now(),
        });
        await db.collection('clients').doc(testId).delete();
        return { ok: true, msg: 'Escritura OK' };
      } catch (e) {
        return { ok: false, msg: e.message, code: e.code };
      }
    },

    async onboardClient(data) {
      const { clientName, ownerName, ownerEmail, ownerPhone, plan, elevenlabsAgentId, tempPassword, bizType } = data;

      if (!clientName || !ownerEmail || !tempPassword) {
        throw new Error('Faltan datos: nombre, correo y contraseña temporal son obligatorios');
      }

      // Verificar sesión del admin
      const adminUser = auth.currentUser;
      if (!adminUser) {
        throw new Error('Sesión expirada. Por favor, cierre sesión y vuelva a entrar.');
      }
      const adminUid = adminUser.uid;

      // Generar ID del cliente (sin depender del UID de Auth)
      const slug = clientName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      const clientId = `${slug}-${Date.now().toString(36)}`;
      const now = firebase.firestore.Timestamp.now();

      // 1. Crear documentos de Firestore PRIMERO (como admin)
      const tpl = this.BIZ_TEMPLATES[bizType] || this.BIZ_TEMPLATES.restaurante;
      const planCfg = this.PLANS[plan] || this.PLANS.basico;
      
      await db.collection('clients').doc(clientId).set({
        name: clientName,
        email: ownerEmail,
        phone: ownerPhone || '',
        status: 'trial',
        plan: plan || 'basico',
        bizType: bizType || 'restaurante',
        elevenlabsAgentId: elevenlabsAgentId || '',
        twilioNumber: '',
        createdAt: now,
        createdBy: adminUid,
      });

      await db.collection('clients').doc(clientId).collection('config').doc('settings').set({
        voice: 'sofia',
        languages: planCfg.idiomasLista,
        minutosIncluidos: planCfg.minutos,
        ubicaciones: planCfg.ubicaciones,
        whatsapp: planCfg.whatsapp,
        gcalendar: planCfg.gcalendar,
        soporte: 'prioritario',
        menuIlimitado: true,
        bizType: bizType || 'restaurante',
        saludo: tpl.saludo.replace('{negocio}', clientName),
        servicios: tpl.servicios,
        preguntas: tpl.preguntas,
        pickup: tpl.pickup,
        delivery: tpl.delivery,
        citas: tpl.citas,
        turnModel: 'turn_v3',
      });

      // 2. Crear usuario en Auth via REST API (no cambia la sesión)
      let uid = null;
      try {
        const apiKey = firebase.app().options.apiKey;
        const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
        const signUpResp = await fetch(signUpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: ownerEmail,
            password: tempPassword,
            returnSecureToken: false
          })
        });
        const signUpData = await signUpResp.json();
        if (signUpResp.ok) {
          uid = signUpData.localId;
          // Crear documento de usuario en Firestore
          await db.collection('users').doc(uid).set({
            email: ownerEmail,
            displayName: ownerName || clientName,
            clientId: clientId,
            role: 'owner',
            createdAt: now,
            createdBy: adminUid,
          });
        } else {
          console.warn('No se pudo crear usuario Auth:', signUpData.error?.message);
        }
      } catch (authErr) {
        console.warn('Error creando usuario Auth (cliente Firestore ya creado):', authErr.message);
      }

      // 3. Registrar actividad
      try {
        await db.collection('activity').add({
          clientId,
          userId: adminUid,
          action: 'client_onboarded',
          details: { clientName, ownerEmail },
          timestamp: now,
        });
      } catch(e) { console.warn('Activity:', e.message); }

      // 4. Generar Excel
      try {
        await this._autoDownloadExcelAfterOnboarding({
          nombre: clientName, correo: ownerEmail, telefono: ownerPhone || '',
          estado: 'trial', plan: plan || 'basico',
          agenteElevenLabs: elevenlabsAgentId || '', numeroTwilio: '',
          creado: new Date().toLocaleDateString('es-CO'), id: clientId,
          tempPassword: tempPassword,
        });
      } catch (e) {
        console.warn('No se pudo generar Excel automático:', e.message);
      }

      return { ok: true, clientId, uid, email: ownerEmail, tempPassword, needsRelogin: false };
    },

    /**
     * Genera Excel automáticamente tras onboarding (sin re-login)
     */
    async _autoDownloadExcelAfterOnboarding(newClient) {
      if (typeof XLSX === 'undefined') return;
      // Intentar obtener clientes existentes (puede fallar sin sesión)
      let rows = [];
      try {
        const existing = await this.getAllClients();
        rows = existing.map(c => ({
          'Restaurante': c.nombre, 'Correo': c.correo,
          'Teléfono': c.telefono, 'Estado': c.estado, 'Plan': c.plan,
          'Agente ElevenLabs': c.agenteElevenLabs, 'Número Twilio': c.numeroTwilio,
          'Fecha creación': c.creado, 'ID Cliente': c.id,
        }));
      } catch (e) { /* sin sesión, solo el nuevo */ }
      rows.push({
        'Restaurante': newClient.nombre, 'Correo': newClient.correo,
        'Teléfono': newClient.telefono, 'Estado': newClient.estado, 'Plan': newClient.plan,
        'Agente ElevenLabs': newClient.agenteElevenLabs, 'Número Twilio': newClient.numeroTwilio,
        'Fecha creación': newClient.creado, 'ID Cliente': newClient.id,
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 30 }, { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
        { wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 25 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      // Nombre fijo: un solo Excel
      XLSX.writeFile(wb, `Voxia-Clientes.xlsx`);
    },

    /**
     * Obtiene todos los clientes (solo superadmin) para el Excel
     */
    async getAllClients() {
      const snap = await db.collection('clients').get();
      const clients = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        // Buscar el usuario owner de este cliente
        const usersSnap = await db.collection('users')
          .where('clientId', '==', doc.id).limit(1).get();
        let ownerEmail = data.email || '';
        let tempPw = '';
        if (!usersSnap.empty) {
          ownerEmail = usersSnap.docs[0].data().email || ownerEmail;
        }
        clients.push({
          id: doc.id,
          nombre: data.name || '',
          correo: ownerEmail,
          telefono: data.phone || '',
          estado: data.status || '',
          plan: data.plan || '',
          agenteElevenLabs: data.elevenlabsAgentId || '',
          numeroTwilio: data.twilioNumber || '',
          creado: data.createdAt ? data.createdAt.toDate().toLocaleDateString('es-CO') : '',
        });
      }
      return clients;
    },

    /**
     * Genera y descarga el Excel de clientes automáticamente
     * Usa SheetJS (debe estar cargado en la página)
     */
    async downloadClientsExcel() {
      if (typeof XLSX === 'undefined') {
        throw new Error('Librería Excel no cargada');
      }
      const clients = await this.getAllClients();
      const ws = XLSX.utils.json_to_sheet(clients.map(c => ({
        'Restaurante': c.nombre,
        'Correo': c.correo,
        'Teléfono': c.telefono,
        'Estado': c.estado,
        'Plan': c.plan,
        'Agente ElevenLabs': c.agenteElevenLabs,
        'Número Twilio': c.numeroTwilio,
        'Fecha creación': c.creado,
        'ID Cliente': c.id,
      })));
      ws['!cols'] = [
        { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 12 },
        { wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 25 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      // Nombre fijo: un solo Excel que se actualiza (el navegador lo sobrescribe o añade (1))
      XLSX.writeFile(wb, `Voxia-Clientes.xlsx`);
      return clients.length;
    },
    async logActivity(action, details) {
      if (!this.user || !this.clientId) return;
      try {
        const fn = functions.httpsCallable('logActivity');
        await fn({ clientId: this.clientId, action, details });
      } catch (e) {
        console.warn('No se pudo registrar actividad:', e.message);
      }
    },

    /**
     * SISTEMA DE ALERTAS — todo conectado automáticamente.
     *
     * Las alertas llegan a:
     *  1. Panel (campana, tiempo real) — siempre
     *  2. Correo del cliente — automático
     *  3. WhatsApp — si el plan lo incluye (Pro/Premium)
     *
     * Se crean en: clients/{id}/alerts y se muestran en el panel en vivo.
     */
    async createAlert(tipo, titulo, mensaje, datos) {
      if (!this.clientId) return;
      const alertData = {
        tipo, // 'warning' | 'urgent' | 'info' | 'overage'
        titulo,
        mensaje,
        datos: datos || {},
        leida: false,
        clientId: this.clientId,
        clientName: this.clientData?.name || '',
        creada: firebase.firestore.Timestamp.now(),
      };
      // 1. Alerta para el cliente (la ve en su panel)
      const alertRef = await db.collection('clients').doc(this.clientId)
        .collection('alerts').add(alertData);

      // 2. ALERTA PARA NOSOTROS (admin) — para estar pendientes del cliente
      // Solo si quien genera la alerta NO es superadmin (evita duplicados)
      const esAdmin = this.userData?.role === 'superadmin';
      if (!esAdmin) {
        await db.collection('admin_alerts').add({
          ...alertData,
          paraAdmin: true,
        });
      } else {
        // Si es el admin viendo su propio demo, igual registra para seguimiento
        await db.collection('admin_alerts').add({
          ...alertData,
          paraAdmin: true,
          nota: 'Generada en cliente propio/demo',
        });
      }

      // 3. CORREO AUTOMÁTICO al cliente (vía extensión Trigger Email)
      try {
        const clientEmail = this.clientData?.email;
        if (clientEmail) {
          await db.collection('mail').add({
            to: clientEmail,
            message: {
              subject: `Voxia: ${titulo}`,
              html: `<h2>${titulo}</h2><p>${mensaje}</p><p><a href="https://radiolatinapp.github.io/voxia-panel/">Ver en el panel</a></p>`,
            },
          });
        }
        // Correo al admin también
        const adminEmail = 'ricomoralesjeremy@gmail.com';
        await db.collection('mail').add({
          to: adminEmail,
          message: {
            subject: `Voxia Admin: ${titulo} (${alertData.clientName})`,
            html: `<h2>${titulo}</h2><p>Cliente: ${alertData.clientName}</p><p>${mensaje}</p>`,
          },
        });
      } catch (e) {
        console.warn('No se pudo encolar correo:', e.message);
      }

      // 3. También en actividad general
      await this.logActivity('alert_' + tipo, { titulo });
      return alertRef.id;
    },

    /**
     * Escucha alertas de ADMIN en tiempo real (todos los clientes)
     * Solo superadmin.
     */
    onAdminAlerts(callback) {
      return db.collection('admin_alerts')
        .where('leida', '==', false)
        .orderBy('creada', 'desc')
        .limit(50)
        .onSnapshot(snap => {
          const alerts = [];
          snap.forEach(d => alerts.push({ id: d.id, ...d.data() }));
          callback(alerts);
        });
    },

    /**
     * Escucha alertas en tiempo real (para la campana del panel)
     */
    onAlerts(callback) {
      if (!this.clientId) return () => {};
      return db.collection('clients').doc(this.clientId)
        .collection('alerts')
        .where('leida', '==', false)
        .orderBy('creada', 'desc')
        .limit(20)
        .onSnapshot(snap => {
          const alerts = [];
          snap.forEach(d => alerts.push({ id: d.id, ...d.data() }));
          callback(alerts);
        });
    },

    /**
     * Marca alerta como leída
     */
    async markAlertRead(alertId) {
      if (!this.clientId) return;
      await db.collection('clients').doc(this.clientId)
        .collection('alerts').doc(alertId).update({ leida: true });
    },

    /**
     * Registra minutos y dispara alertas automáticas de uso.
     * Alertas: 80% (aviso), 95% (urgente), 100% (límite + cobro extra).
     */
    async trackUsage(minutos) {
      if (!this.clientId) throw new Error('Sin cliente');
      const periodo = new Date().toISOString().slice(0, 7);
      const ref = db.collection('clients').doc(this.clientId)
        .collection('usage').doc(periodo);

      const planKey = (this.clientData?.plan || 'basico').toLowerCase();
      const plan = this.PLANS[planKey] || this.PLANS.basico;
      const limite = plan.minutos;

      const antes = await ref.get();
      const usadoAntes = antes.exists ? (antes.data().minutos || 0) : 0;

      await ref.set({
        minutos: firebase.firestore.FieldValue.increment(minutos),
        actualizado: firebase.firestore.Timestamp.now(),
      }, { merge: true });

      const usado = usadoAntes + minutos;
      const pctAntes = Math.round((usadoAntes / limite) * 100);
      const pctAhora = Math.round((usado / limite) * 100);
      const excedido = usado > limite;
      const minutosExtra = excedido ? Math.round((usado - limite) * 10) / 10 : 0;

      // ALERTAS AUTOMÁTICAS (solo al cruzar el umbral, no en cada llamada)
      if (pctAntes < 80 && pctAhora >= 80 && pctAhora < 95) {
        await this.createAlert('warning',
          '⚠️ Te quedan pocos minutos',
          `Has usado ${Math.round(usado)} de ${limite} minutos (${pctAhora}%). Te quedan ${Math.round(limite - usado)} minutos este mes.`,
          { usado, limite, porcentaje: pctAhora });
      } else if (pctAntes < 95 && pctAhora >= 95 && pctAhora < 100) {
        await this.createAlert('urgent',
          '🔴 Casi sin minutos',
          `Has usado ${pctAhora}% de tus minutos. Te quedan ${Math.round(limite - usado)}. Considera subir de plan.`,
          { usado, limite, porcentaje: pctAhora });
      } else if (!excedido && pctAhora >= 100 || (usadoAntes <= limite && excedido)) {
        await this.createAlert('overage',
          '💰 Límite alcanzado — cobro por minuto extra',
          `Superaste tus ${limite} minutos. Cada minuto extra cuesta $0.12 y se suma a tu factura automáticamente. Tu servicio sigue funcionando sin interrupción.`,
          { usado, limite, minutosExtra, costoExtra: +(minutosExtra * 0.12).toFixed(2) });
      }

      await this.logActivity(excedido ? 'usage_overage' : 'usage_track',
        { minutos, usado: Math.round(usado * 10) / 10, limite });

      return { usado: Math.round(usado * 10) / 10, limite,
               porcentaje: pctAhora, excedido, minutosExtra,
               costoExtra: +(minutosExtra * 0.12).toFixed(2) };
    },

    /**
     * Actualiza un cliente en Firebase
     */
    async updateClient(clientId, data) {
      if (!this.user) throw new Error('Sin sesión');
      const esAdmin = this.userData?.role === 'superadmin';
      const esPropio = this.clientId === clientId;
      if (!esAdmin && !esPropio) throw new Error('Sin permiso');
      await db.collection('clients').doc(clientId).update({
        ...data,
        updatedAt: firebase.firestore.Timestamp.now(),
      });
    },

    /**
     * Elimina un cliente de Firebase (solo superadmin)
     */
    async deleteClient(clientId) {
      if (!this.user) throw new Error('Sin sesión');
      if (this.userData?.role !== 'superadmin') throw new Error('Solo el admin puede eliminar');
      // Eliminar config primero
      const configDocs = await db.collection('clients').doc(clientId)
        .collection('config').get();
      const batch = db.batch();
      configDocs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('clients').doc(clientId));
      await batch.commit();
    },

    /**
     * Obtiene el uso actual del período (cliente actual)
     */
    async getUsage() {
      if (!this.clientId) return null;
      const periodo = new Date().toISOString().slice(0, 7);
      const snap = await db.collection('clients').doc(this.clientId)
        .collection('usage').doc(periodo).get();
      const planKey = (this.clientData?.plan || 'basico').toLowerCase();
      const plan = this.PLANS[planKey] || this.PLANS.basico;
      const usado = snap.exists ? (snap.data().minutos || 0) : 0;
      return {
        usado: Math.round(usado * 10) / 10,
        limite: plan.minutos,
        disponible: Math.max(0, Math.round((plan.minutos - usado) * 10) / 10),
        porcentaje: Math.round((usado / plan.minutos) * 100),
        excedido: usado > plan.minutos,
        costoExtra: +Math.max(0, (usado - plan.minutos) * 0.12).toFixed(2),
        periodo,
      };
    },

    /**
     * Obtiene el uso de un cliente específico (para admin)
     */
    async getUsageFor(clientId) {
      const periodo = new Date().toISOString().slice(0, 7);
      const clientSnap = await db.collection('clients').doc(clientId).get();
      if (!clientSnap.exists) return null;
      const planKey = (clientSnap.data().plan || 'basico').toLowerCase();
      const plan = this.PLANS[planKey] || this.PLANS.basico;
      const snap = await db.collection('clients').doc(clientId)
        .collection('usage').doc(periodo).get();
      const usado = snap.exists ? (snap.data().minutos || 0) : 0;
      return {
        usado: Math.round(usado * 10) / 10,
        limite: plan.minutos,
        disponible: Math.max(0, Math.round((plan.minutos - usado) * 10) / 10),
        porcentaje: Math.round((usado / plan.minutos) * 100),
        excedido: usado > plan.minutos,
        costoExtra: +Math.max(0, (usado - plan.minutos) * 0.12).toFixed(2),
        periodo,
      };
    },

    /**
     * Observador de sesión (llamar al cargar la página)
     */
    onAuthChange(callback) {
      return auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            await this.loadUserData(user.uid);
          } catch (e) {
            console.error('Error cargando datos:', e);
            await auth.signOut();
            callback(null);
            return;
          }
        } else {
          this.user = null;
          this.userData = null;
          this.clientId = null;
          this.clientData = null;
        }
        callback(user);
      });
    }
  };

  // Exponer globalmente
  window.VoxiaDB = VoxiaDB;
})();
