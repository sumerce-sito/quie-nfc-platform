# Seguridad de la plataforma QUIE NFC

Este documento resume las caracteristicas de seguridad implementadas en la plataforma QUIE NFC para la entrega del hackathon, junto con los puntos que deben reforzarse antes de una salida a produccion.

## Estado general

La plataforma no debe describirse como "blindada" en sentido absoluto. Si puede presentarse como una plataforma con controles de seguridad importantes para una demo funcional: autenticacion protegida, validacion estricta, rate limiting, cabeceras HTTP seguras, control de archivos subidos y deteccion basica de patrones antifraude en escaneos NFC.

## Medidas ya implementadas

- Autenticacion de panel admin mediante usuario y contrasena.
- Contrasenas verificadas con hash `bcrypt`.
- Sesion admin con JWT.
- JWT enviado en cookie `httpOnly`.
- Cookie marcada como `secure` cuando `NODE_ENV=production`.
- Bloqueo temporal por intentos fallidos de login.
- Rate limiting general para la aplicacion.
- Rate limiting especifico para login.
- Rate limiting especifico para escaneos NFC publicos.
- Rate limiting especifico para registro de clientes.
- Validacion de entradas con `express-validator`.
- Formato estricto para codigos NFC: `QUIE-[6ALNUM]-[CHECKSUM]`.
- Formato estricto para lotes: `QUIE-[CATEGORIA]-[ANIO]-[SEC]`.
- Rutas admin protegidas con middleware `requireAuth`.
- APIs internas protegidas por sesion.
- Cabeceras de seguridad con `helmet`.
- `X-Powered-By` desactivado.
- Proteccion anti-clickjacking mediante `frameAncestors: 'none'`.
- `X-Content-Type-Options: nosniff`.
- Politica de referrer estricta.
- Manejo de errores sin exponer stack traces al usuario.
- Uploads limitados por tamano.
- Uploads restringidos a imagenes `jpg`, `png` y `webp`.
- Nombres de archivos sanitizados.
- Deteccion basica antifraude en escaneos:
  - demasiados escaneos en una ventana corta;
  - escaneos desde paises distintos en poco tiempo;
  - lotes activos sin circulacion.

## Seguridad aplicada al flujo NFC

Cada URL NFC publica usa un formato controlado. Un codigo valido debe cumplir:

```text
QUIE-[6ALNUM]-[2DIGITOS]
```

Ejemplo:

```text
QUIE-A7B3X9-42
```

Si el codigo no cumple formato, la peticion se rechaza. Si cumple formato pero no existe en el sistema, se muestra una pagina de codigo no encontrado, orientada a posible producto no autentico.

## Seguridad aplicada al panel admin

El panel NEXO Admin esta protegido por sesion. Las rutas administrativas y endpoints internos requieren autenticacion. Los intentos fallidos de acceso se cuentan por IP y pueden activar bloqueo temporal.

Para la demo del hackathon existe una credencial de respaldo. Esta decision facilita la evaluacion en Vercel, pero no debe mantenerse en produccion.

## Puntos pendientes antes de produccion

- Eliminar credenciales demo hardcodeadas.
- Exigir `JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD_HASH` reales en Vercel.
- Conectar Aurora PostgreSQL para productos, lotes y codigos.
- Conectar DynamoDB para escaneos, auditoria y eventos antifraude.
- Agregar proteccion CSRF para formularios admin.
- Agregar revocacion/rotacion de sesiones.
- Endurecer CSP y reducir dependencia de `unsafe-inline`.
- Agregar monitoreo centralizado de errores y eventos de seguridad.
- Agregar pruebas automatizadas de seguridad basica.
- Separar roles si habra mas de un tipo de usuario admin.
- Reemplazar almacenamiento temporal de archivos por S3 o equivalente.

## Declaracion sugerida para jurados

La plataforma QUIE NFC incluye autenticacion con JWT en cookie `httpOnly`, contrasenas hasheadas con `bcrypt`, bloqueo por intentos fallidos, rate limiting, validacion estricta de codigos NFC, cabeceras de seguridad con Helmet, control de uploads y deteccion basica de patrones antifraude en escaneos.

Para la etapa post-hackathon, el plan de hardening contempla persistencia en Aurora PostgreSQL y DynamoDB, eliminacion de credenciales demo, auditoria centralizada, proteccion CSRF y endurecimiento de politicas CSP.
