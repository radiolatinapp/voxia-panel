# 🎙️ Voxia · Command Center

Panel comercial premium para gestionar el negocio de **asistentes de voz con IA para cualquier negocio**. Estética nivel Stripe/Linear: modo oscuro elegante + modo claro, tipografía Inter, micro-animaciones y gráficas SVG.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `dashboard.html` | Panel premium v2.1 (un solo archivo, funciona sin servidor) |
| `logo.svg` | Logo premium de Voxia (gradientes, glow) |

## 🚀 Cómo usarlo

1. Abre `dashboard.html` en cualquier navegador (doble clic, no necesita servidor).
2. **Inicia sesión** con una cuenta demo (ver sección Usuarios): `admin@voxia.ai` / `voxia2026`. La sesión se recuerda.
3. Navega por las 16 secciones del menú lateral (varían según tu rol):
   - **Dashboard** — contadores animados, barras 14 días, dona de idiomas ES/EN, tendencia de MRR, estado de agentes y últimas llamadas con reproductor.
   - **Llamadas** — historial con filtros (negocio, idioma, resultado); cada llamada se expande con **reproductor de audio simulado** y transcripción.
   - **💬 Transcripciones** *(nuevo)* — conversaciones completas con **búsqueda de texto** (resalta coincidencias).
   - **🔔 Notificaciones** *(nuevo)* — centro de alertas completo (llamada perdida, pago vencido, cliente inactivo), filtros por tipo, marcar como leídas.
   - **Clientes** — avatares de colores, buscador, filtros por estado, modal premium para agregar/editar.
   - **📊 Comparativa** *(nuevo)* — tabla de rendimiento lado a lado (llamadas, conversión, ingresos, ganancia) + 🏆 mejor cliente del período.
   - **Asistentes** — toggles animados, vista previa de voz con onda animada, bienvenida/horario/voz/idiomas.
   - **📋 Plantillas** *(nuevo)* — 5 plantillas por tipo de negocio (🍽️ restaurante, 🦷 clínica dental, 🔧 taller, 💇 salón, 🏨 hotel) con saludo, capacidades y voz recomendada.
   - **🎙️ Voces** *(nuevo)* — biblioteca de 8 voces (idioma, género, tono), onda visual, muestra de audio simulada y asignación a asistentes.
   - **Finanzas** — rentabilidad por cliente + **calculadora de precio** interactiva + 🧾 próximo pago mensual a proveedores.
   - **🧾 Facturación** — facturas por cliente (pagada/pendiente/vencida), detalle con líneas y botón "marcar pagada".
   - **📈 Reportes** *(nuevo)* — genera y **descarga reportes reales** (CSV/JSON/TXT) por período y cliente + historial de reportes.
   - **👥 Equipo** — gestión completa de usuarios: crear, editar, activar/desactivar, eliminar, restablecer contraseñas (solo admin).
   - **📋 Actividad** *(nuevo)* — registro de "quién hizo qué" con buscador.
   - **👤 Mi perfil** *(nuevo)* — datos personales, color de avatar y cambio de contraseña (en el menú del avatar superior).
   - **🔌 Integraciones** *(nuevo)* — tarjetas ElevenLabs, Twilio, WhatsApp Business, Stripe, Google Calendar (conectado/pendiente) + claves API.
   - **⚙️ Configuración** — perfil de la empresa, notificaciones y conexiones.
3. **Atajos de teclado:** `1-9` para navegar entre vistas, `P` modo presentación, `E` exportar datos JSON, `?` ayuda de atajos, `Esc` cerrar modales.
4. Usa el **buscador global** (arriba) para saltar a clientes, el **botón luna/sol** para cambiar de tema, la **campana** para notificaciones y el **botón expandir** para modo presentación.

## 👥 Usuarios y autenticación

El panel tiene **login funcional** con sesión persistente (se recuerda en el navegador):

| Cuenta demo | Contraseña | Rol |
|---|---|---|
| `admin@voxia.ai` | `voxia2026` | 👑 Administrador — acceso total |
| `gerente@voxia.ai` | `gerente2026` | 🧭 Gerente — gestiona clientes y asistentes (sin finanzas ni configuración) |
| `agente@voxia.ai` | `agente2026` | 🎧 Agente — solo ver dashboard, llamadas y clientes |

**Permisos por rol:**
- **Administrador:** todo (incluye Equipo, Finanzas, Facturación, Configuración, Integraciones).
- **Gerente:** dashboard, llamadas, transcripciones, notificaciones, clientes, comparativa, asistentes, plantillas, voces, reportes y actividad. Puede crear/editar negocios y asistentes.
- **Agente:** solo dashboard, llamadas, transcripciones, notificaciones y clientes — **sin editar** (botones ocultos y campos bloqueados).

**Funciones:** crear/editar usuarios, activar/desactivar, eliminar, restablecer contraseñas (solo admin), **registro de actividad** (quién hizo qué), **Mi perfil** (nombre, color de avatar, cambio de contraseña) y cerrar sesión.

> 🔒 **Nota:** demo local — las cuentas se guardan con hash simple en `localStorage` del navegador. En producción debe usarse un backend real (bcrypt + sesiones httpOnly).

## 💡 Datos de ejemplo

El panel viene con 4 negocios de ejemplo (Charlotte, NC) y llamadas para que se vea cómo funciona con datos reales. **Todos los costos se calculan automáticamente desde una tarifa única** (`RATE = $0.0085/min Twilio + $0.08/min ElevenLabs`); los datos de ejemplo se normalizan al cargar para que minutos y dinero siempre cuadren en todas las vistas.

Para producción, estos datos se conectarían a las APIs de **ElevenLabs** y **Twilio** (ver sección Conexiones en Configuración del panel):

- Llamadas y minutos → API de ElevenLabs (Conversational AI)
- Números y costos de telefonía → API de Twilio
- Clientes y menús → base de datos propia (ej. Firestore)

## 🎨 Identidad

- **Nombre:** Voxia
- **Colores:** azul oscuro `#0a1c38` + naranja `#f59a1f` / dorado
- **Logo:** barras de sonido formando una "V" con punto de voz

## 💰 Modelo de negocio sugerido

| Plan | Precio/mes | Ideal para |
|---|---|---|
| Básico | $149 | Negocios pequeños |
| Pro | $249 | Negocios medianos ⭐ |
| Premium | $399 | Cadenas / alto volumen |

Costo aproximado por minuto: **$0.09** (voz $0.08 + telefonía $0.01).
Con 800 llamadas de 2 min al mes: costo ~$144 → cobrando $249, ganancia **~$105/cliente/mes**.

---
*Voxia © 2026 · La voz inteligente de tu negocio 📞*
