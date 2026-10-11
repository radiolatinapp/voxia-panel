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
     * Onboarding completo de cliente nuevo (solo superadmin).
     * Crea usuario Auth + docs en Firestore, todo conectado.
     */
    async onboardClient(data) {
      const fn = functions.httpsCallable('onboardClient');
      const result = await fn(data);
      return result.data;
    },

    /**
     * Registra actividad
     */
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
