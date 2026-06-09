# QUIE® NFC

Sistema web para autenticidad, catalogo y seguimiento de piezas QUIE® mediante codigos NFC.

## Que hace

- Publica una pagina principal de la marca.
- Permite crear un catalogo editable de piezas con descripciones, colores, fotos y datos comerciales.
- Genera lotes de accesorios con codigos NFC unicos.
- Exporta CSV con las URL que deben escribirse en cada tag NFC.
- Muestra una pagina publica de verificacion por codigo:
  - producto autentico,
  - primer escaneo,
  - reescaneos,
  - posible alerta por uso sospechoso.
- Permite registrar propietario de la pieza con nombre, WhatsApp, ciudad, email y foto opcional.
- Incluye panel admin protegido por login.
- Registra escaneos, clientes, lotes, codigos, auditoria y productos.
- Muestra promocion de recompra desde el segundo escaneo.

## Stack

- Node.js
- Express
- HTML/CSS/JavaScript sin framework frontend
- Archivos JSON como almacenamiento inicial
- PM2 para proceso en produccion
- Nginx como proxy reverso en VPS

## Estructura

```text
web/                  Paginas publicas y admin
sistema/              Backend Express y modulos internos
base_datos/           Datos JSON del sistema
auditoria/            Log de eventos
codigos_csv/          CSV generados por lote
uploads/clientes/     Fotos subidas por clientes
uploads/productos/    Fotos del catalogo
guias_tags/           Documentacion NFC
landing_pages/        Plantillas
```

## Variables de entorno

Crear un archivo `.env` basado en `.env.example`.

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=...
JWT_EXPIRES_IN=2h
COOKIE_SECRET=...
ADMIN_USERNAME=chl_admin
ADMIN_PASSWORD_HASH=...
DOMAIN=2.25.180.135
BASE_URL=http://2.25.180.135
```

En produccion con dominio y HTTPS se puede usar:

```env
NODE_ENV=production
FORCE_HTTPS=true
DOMAIN=tudominio.com
BASE_URL=https://tudominio.com
```

## Comandos locales

Instalar dependencias:

```bash
npm install
```

Iniciar:

```bash
npm start
```

Modo desarrollo:

```bash
npm run dev
```

## Despliegue VPS

El despliegue recomendado es Ubuntu + Node.js + PM2 + Nginx.

Instalar dependencias del servidor:

```bash
apt update
apt install -y nodejs npm nginx unzip
npm install -g pm2
```

Subir el proyecto, instalar dependencias y arrancar:

```bash
cd /var/www/quie
npm install --omit=dev
mkdir -p uploads/clientes uploads/productos codigos_csv reportes auditoria base_datos
pm2 start sistema/servidor.js --name quie
pm2 save
```

Reiniciar app:

```bash
pm2 restart quie --update-env
```

Ver estado:

```bash
pm2 status
systemctl status nginx --no-pager
```

## Flujo de uso

1. Entrar al panel admin en `/login`.
2. Crear o editar productos en "Catalogo de piezas".
3. Crear un lote usando una pieza del catalogo.
4. Descargar el CSV del lote.
5. Escribir manualmente en cada tag la URL de la columna `url_landing`.
6. Probar la URL `/v/CODIGO`.
7. Activar el lote.
8. Los clientes escanean, verifican autenticidad y pueden registrar su pieza.

## Datos importantes

El sistema usa JSON como almacenamiento inicial. Es suficiente para pruebas, pilotos y operacion pequena.

Para alto volumen, por ejemplo 100.000 o 1.000.000 de registros, se recomienda migrar a PostgreSQL o MySQL. Las entidades a migrar son:

- productos
- lotes
- codigos
- escaneos
- clientes
- auditoria

## Backups recomendados

Respaldar periodicamente:

```text
base_datos/
auditoria/
codigos_csv/
reportes/
uploads/
.env
```

## Notas NFC

Cada tag debe escribirse con la URL completa:

```text
http://IP_O_DOMINIO/v/QUIE-XXXXXX-00
```

Para produccion definitiva conviene usar dominio con HTTPS antes de escribir tags finales.

