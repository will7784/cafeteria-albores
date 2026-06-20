# Sesión de Desarrollo - Cafetería Albores

**Fecha:** 19 de junio de 2026
**Proyecto:** Aplicación de Ingresos y Egresos para Cafetería Albores (Cali, Colombia)
**Stack:** Flask (Python) + SQLAlchemy + PostgreSQL/SQLite + HTML/CSS/JS
**Deploy:** Railway (https://railway.app)
**Repositorio:** https://github.com/will7784/cafeteria-albores.git

---

## 1. DESCRIPCIÓN DEL PROYECTO

Aplicación web responsive optimizada para tablet táctil (pantalla táctil de cafetería) que permite:

- Registrar **ingresos** y **egresos** con categorías personalizables
- Cada transacción va asociada a un **bolsillo** (caja/contenedor): Efectivo, Nequi, Bancolombia
- Fecha y hora automática del sistema
- Resumen diario de ingresos/egresos
- Reportes mensuales con gráficos
- Gestión de categorías y bolsillos dinámicos
- Autenticación de usuarios con superusuarios
- Editar y eliminar transacciones

### Concepto clave: Bolsillo = Caja/Contenedor
No es una categoría. Es el medio por donde entra/sale el dinero (Efectivo, Nequi, Bancolombia).

---

## 2. ESTRUCTURA DEL PROYECTO

```
cafeteria/
├── app.py                 # Backend Flask + SQLAlchemy + Flask-Login
├── migrate.py             # Script de inicialización de DB (tablas + datos por defecto)
├── requirements.txt       # Dependencias Python
├── Procfile               # Configuración para Railway (Gunicorn)
├── .gitignore             # Ignorar DB local, cache, etc.
├── templates/
│   ├── index.html         # App principal (registro, resumen, bolsillos, reportes, config)
│   └── login.html         # Pantalla de login
└── static/
    ├── css/
    │   ├── style.css      # Estilos de la app principal
    │   └── login.css      # Estilos del login
    └── js/
        └── app.js         # Lógica JavaScript de la app
```

---

## 3. MODELO DE DATOS (SQLAlchemy)

### Tabla: `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Integer PK | ID autoincremental |
| username | String(80) | Nombre de usuario único |
| password_hash | String(255) | Hash de contraseña (Werkzeug) |
| is_superuser | Integer | 1 = superuser, 0 = normal |
| activo | Integer | 1 = activo, 0 = inactivo |
| created_at | String | Fecha de creación |

### Tabla: `categorias`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Integer PK | ID autoincremental |
| tipo | String(20) | 'ingreso' o 'egreso' |
| nombre | String(100) | Nombre de la categoría |
| es_vueltas | Integer | 1 = sin detalle (no usado actualmente) |
| activo | Integer | 1 = activo, 0 = eliminado |

### Tabla: `bolsillos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Integer PK | ID autoincremental |
| nombre | String(100) | Nombre del bolsillo (Efectivo, Nequi, etc.) |
| icono | String(10) | Emoji/icono (💵, 📱, 🏦) |
| orden | Integer | Orden de visualización |
| activo | Integer | 1 = activo, 0 = eliminado |

### Tabla: `transacciones`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Integer PK | ID autoincremental |
| tipo | String(20) | 'ingreso' o 'egreso' |
| bolsillo | String(100) | Bolsillo asociado |
| categoria | String(100) | Categoría de la transacción |
| subcategoria | String(100) | Detalle adicional (opcional) |
| monto | Float | Monto de la transacción |
| descripcion | String(255) | Nota adicional (opcional) |
| fecha_hora | String(50) | Fecha/hora completa (ISO) |
| fecha | String(10) | Solo fecha (YYYY-MM-DD) |
| user_id | Integer FK | Usuario que creó la transacción |

---

## 4. CATEGORÍAS POR DEFECTO

### Ingresos:
- Ventas del día
- Ventas día anterior
- Préstamo
- Otros ingresos

### Egresos:
- Insumos
- Nómina
- Servicios públicos
- Arriendo
- Otros egresos

### Bolsillos por defecto:
- 💵 Efectivo
- 📱 Nequi
- 🏦 Bancolombia

---

## 5. API ENDPOINTS

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/login` | Login (JSON: username, password) |
| GET | `/logout` | Cerrar sesión |
| GET | `/api/auth/check` | Verificar sesión activa |

### Usuarios (solo superuser)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/users` | Listar todos los usuarios |
| POST | `/api/users` | Crear nuevo usuario |
| DELETE | `/api/users/<id>` | Desactivar usuario |
| POST | `/api/users/cambiar-password` | Cambiar contraseña propia |

### Bolsillos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/bolsillos` | Listar bolsillos activos |
| POST | `/api/bolsillos` | Crear bolsillo |
| DELETE | `/api/bolsillos/<id>` | Eliminar bolsillo (si no tiene transacciones) |

### Categorías
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/categorias?tipo=ingreso/egreso` | Listar categorías por tipo |
| GET | `/api/categorias/all` | Listar todas las categorías |
| POST | `/api/categorias` | Crear categoría |
| DELETE | `/api/categorias/<id>` | Eliminar categoría (si no tiene transacciones) |

### Transacciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/transacciones` | Crear transacción |
| DELETE | `/api/transacciones/<id>` | Eliminar transacción |
| PUT | `/api/transacciones/<id>` | Editar transacción (monto, bolsillo, categoría, etc.) |
| GET | `/api/transacciones/recent` | Últimas 50 transacciones del día |

### Reportes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/resumen-diario?fecha=YYYY-MM-DD` | Resumen del día |
| GET | `/api/reporte-mensual?mes=YYYY-MM` | Reporte mensual |

---

## 6. FLUJO DE USUARIO

### Login
1. Usuario accede a la URL
2. Redirigido a `/login`
3. Ingresa username y password
4. Si es válido, redirigido a la app principal

### Registrar transacción
1. Seleccionar tipo: INGRESO o EGRESO
2. Seleccionar bolsillo (caja): Efectivo, Nequi, Bancolombia
3. Ingresar monto
4. Seleccionar categoría
5. Ingresar detalle (opcional)
6. Ingresar descripción (opcional)
7. Guardar

### Ver resumen
- **Resumen Hoy:** Cards con ingresos, egresos, balance + detalle por categoría
- **Bolsillos:** Saldo acumulado de cada bolsillo
- **Mensual:** Gráfico de barras por día + totales por categoría y bolsillo

### Configuración
- **Categorías:** Crear/eliminar categorías de ingreso y egreso
- **Bolsillos:** Crear/eliminar bolsillos con icono
- **Usuarios:** Crear/eliminar usuarios (solo superuser)
- **Cambiar contraseña:** Disponible para todos los usuarios

---

## 7. PERMISOS DE USUARIO

| Función | Usuario Normal | Superusuario |
|---------|---------------|--------------|
| Registrar transacciones | ✅ | ✅ |
| Ver resúmenes y reportes | ✅ | ✅ |
| Crear/eliminar categorías | ✅ | ✅ |
| Crear/eliminar bolsillos | ✅ | ✅ |
| Crear/eliminar usuarios | ❌ | ✅ |
| Cambiar contraseña propia | ✅ | ✅ |

---

## 8. DEPLOY EN RAILWAY

### Requisitos
- Cuenta en Railway (https://railway.app)
- Repositorio GitHub conectado

### Pasos
1. Crear nuevo proyecto en Railway → Deploy from GitHub repo
2. Seleccionar `cafeteria-albores`
3. Agregar PostgreSQL: New → Database → Add PostgreSQL
4. Railway crea automáticamente `DATABASE_URL`
5. La app detecta `DATABASE_URL` y usa PostgreSQL
6. El `Procfile` ejecuta `migrate.py` antes de iniciar Gunicorn
7. Tablas y datos por defecto se crean automáticamente

### Variables de entorno (opcional)
- `SECRET_KEY`: Clave secreta para Flask (generar en randomkeygen.com)

### URL pública
Railway asigna automáticamente una URL tipo:
`https://cafeteria-albores.up.railway.app`

---

## 9. CREDENCIALES POR DEFECTO

**Superusuario:**
- Usuario: `admin`
- Contraseña: `admin123`

**Nota:** Se recomienda cambiar la contraseña al ingresar por primera vez.

---

## 10. DEPENDENCIAS (requirements.txt)

```
Flask==3.0.3
Flask-SQLAlchemy==3.1.1
Flask-Login==0.6.3
Werkzeug==3.0.3
psycopg2-binary==2.9.9
gunicorn==23.0.0
```

---

## 11. NOTAS TÉCNICAS

### Base de datos
- **Local:** SQLite (`sqlite:///cafeteria.db`)
- **Producción:** PostgreSQL (Railway, detectado via `DATABASE_URL`)
- La app usa SQLAlchemy ORM, compatible con ambos

### Seguridad
- Contraseñas hasheadas con Werkzeug (bcrypt)
- Sesiones manejadas con Flask-Login
- Rutas protegidas con `@login_required`
- Superusuarios verificados en endpoints sensibles

### Responsive / Tablet
- Diseño mobile-first, max-width 600px
- Botones mínimo 48px para touch
- Input mode decimal para teclado numérico en móviles
- Sin zoom, sin scroll horizontal
- Dark mode support

### Cache busting
- Archivos estáticos con query string: `app.js?v=2`
- Forzar recarga: Ctrl+Shift+R

---

## 12. MEJORAS FUTURAS POSIBLES

- [ ] Exportar reportes a Excel/PDF
- [ ] Backup automático de base de datos
- [ ] Múltiples sucursales
- [ ] Inventario de productos
- [ ] Facturación electrónica
- [ ] Notificaciones por email/WhatsApp
- [ ] Dashboard con gráficos más avanzados
- [ ] App móvil nativa (React Native/Flutter)
- [ ] Multi-moneda
- [ ] Integración con Nequi/Bancolombia API

---

## 13. COMANDOS ÚTILES

### Local
```bash
# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
python app.py

# Recrear base de datos
rm -f cafeteria.db && python app.py
```

### Git
```bash
# Ver estado
git status

# Commit y push
git add -A
git commit -m "mensaje"
git push origin main
```

### Railway CLI (opcional)
```bash
# Login
railway login

# Conectar proyecto
railway link

# Ver logs
railway logs

# Ejecutar migración manual
railway run python migrate.py
```

---

## 14. CONTACTO Y SOPORTE

- **Repositorio:** https://github.com/will7784/cafeteria-albores
- **Deploy:** Railway Dashboard
- **Stack:** Python, Flask, SQLAlchemy, PostgreSQL, HTML, CSS, JavaScript

---

*Documento generado el 19 de junio de 2026. Última actualización: v1.0*
