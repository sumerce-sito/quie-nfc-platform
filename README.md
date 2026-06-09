# QUIE® NFC Platform

Plataforma de autenticidad NFC para accesorios premium colombianos QUIE®. Proyecto para **H0: Hack the Zero Stack — AWS + Vercel**.

QUIE® combina marca de lujo artesanal, certificados digitales por NFC y trazabilidad de producto para bolsos, billeteras, tarjeteros, correas, llaveros y maletines ejecutivos.

## Propuesta

Cada pieza QUIE® puede incluir un tag NTAG213 oculto. Al escanearlo, el cliente abre una experiencia web donde puede:

- Verificar autenticidad del producto.
- Consultar numero de serie y lote.
- Conocer origen, material y cuidado de la pieza.
- Registrar propietario opcionalmente.
- Generar eventos de escaneo para analitica antifraude y engagement.

## Stack Hackathon

- **Frontend:** Next.js + TypeScript
- **Deploy frontend:** Vercel
- **Base relacional:** AWS Aurora PostgreSQL
- **Eventos de escaneo:** AWS DynamoDB
- **Infraestructura:** AWS
- **Tags fisicos:** NTAG213
- **Autenticidad:** codigos NFC con formato QUIE y checksum

## Arquitectura

```text
Cliente escanea NFC
        |
        v
Next.js /v/[codigo]
        |
        +-- Aurora PostgreSQL
        |   - productos
        |   - lotes
        |   - codigos
        |   - clientes
        |
        +-- DynamoDB
            - escaneos por codigo, timestamp, IP, ciudad y dispositivo
```

## Estructura del repo

```text
web/                         Landing y pantallas prototipo de experiencia NFC
sistema/                     Logica prototipo para generacion y validacion NFC
database/aurora/             Schema Aurora PostgreSQL y seeds [DEMO]
documentacion/               Guia de marca QUIE y decisiones de producto
logos y marcas/              Logo, brand board y concepto visual
guias_tags/                  Guia operativa NTAG213
landing_pages/               Plantilla de autenticidad NFC
quie-submission.md           Documento de submission del hackathon
```

## Modelo de datos

Aurora PostgreSQL:

- `productos`: catalogo de accesorios QUIE®.
- `lotes`: lotes de produccion con estado y total de tags.
- `codigos`: codigos NFC unicos, URL de landing, checksum y estado.
- `clientes`: registro opcional de propietario.
- `auditoria`: eventos administrativos.

DynamoDB:

- `escaneos`: eventos de lectura NFC por `codigo_id`, `timestamp`, `ip`, `ciudad` y `dispositivo`.

## Convenciones NFC

Lotes:

```text
QUIE-[CATEGORIA]-[AÑO]-[SEC]
```

Ejemplo:

```text
QUIE-BOL-2025-001
```

Codigos NFC:

```text
QUIE-[6ALNUM]-[CHECKSUM]
```

Ejemplo:

```text
QUIE-A7B3X9-42
```

## Variables de entorno

Crear `.env` desde `.env.example`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=
DB_PORT=5432
DB_NAME=quie_nfc
DB_USER=
DB_PASSWORD=

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
DYNAMODB_TABLE_ESCANEOS=quie_escaneos

BASE_URL=http://localhost:3000
JWT_SECRET=
```

## Aurora PostgreSQL

Migraciones:

```bash
psql "$DATABASE_URL" -f database/aurora/001_init.sql
psql "$DATABASE_URL" -f database/aurora/002_seed_demo.sql
```

`002_seed_demo.sql` solo debe usarse en entornos locales, previews o demo. Todos los datos estan marcados como `[DEMO]`.

## Flujo de producto

1. Crear producto QUIE® en el catalogo.
2. Crear lote con formato `QUIE-[CATEGORIA]-[AÑO]-[SEC]`.
3. Generar codigos NFC unicos con checksum.
4. Escribir URL publica en tags NTAG213.
5. Publicar landing `/v/[codigo]` en Vercel.
6. Guardar datos transaccionales en Aurora.
7. Registrar eventos de escaneo en DynamoDB.
8. Mostrar certificado digital, historia de la pieza y señales de autenticidad.

## Marca

QUIE® significa "Tierra". La direccion visual esta documentada en:

- `logos y marcas/logos y aplicaciones/completa.png`
- `logos y marcas/logos y aplicaciones/marketing.txt`
- `documentacion/GUIA_MARCA_QUIE.md`

Principios:

- Lujo silencioso.
- Raiz colombiana.
- Materiales nobles.
- Autenticidad NFC.
- Piezas hechas para durar.

## Estado del proyecto

Listo:

- Limpieza completa de marca heredada.
- Landing premium v1.
- Guia de marca QUIE®.
- Schema Aurora PostgreSQL.
- Seeds [DEMO].
- Documento de submission.
- Repo publico en GitHub.

Siguiente:

- Scaffold Next.js + TypeScript.
- API routes para codigos NFC.
- Integracion Aurora.
- Registro de escaneos en DynamoDB.
- Deploy en Vercel.
