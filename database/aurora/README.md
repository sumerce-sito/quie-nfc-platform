# Aurora PostgreSQL

Schema base para QUIE NFC Platform en AWS Aurora PostgreSQL Serverless v2.

## Orden de ejecucion

```bash
psql "$DATABASE_URL" -f database/aurora/schema.sql
psql "$DATABASE_URL" -f database/aurora/seeds.sql
```

`seeds.sql` solo debe usarse en entornos locales, previews o demos del hackathon. Todos los datos insertados estan marcados como `[DEMO]`.

## Aurora Serverless v2

El auto-pause no se activa desde SQL. Configuralo en el cluster Aurora Serverless v2 cuando la base este disponible:

- Engine: Aurora PostgreSQL compatible con PostgreSQL 15+
- Min capacity: `0 ACU`
- Max capacity: segun carga esperada
- Auto-pause: habilitado con el tiempo de pausa que definas para demo/costos

## Modelo

- `productos`: catalogo comercial de accesorios QUIE.
- `artesanos`: storytelling y ficha publica del maestro artesano.
- `lotes`: lotes de produccion con formato `QUIE-[CATEGORIA]-[AÑO]-[SEC]`.
- `codigos`: codigos NFC unicos con formato `QUIE-[6ALNUM]-[CHECKSUM]`.

## Variables de entorno

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
POSTGRES_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
POSTGRES_HOST="HOST"
POSTGRES_PORT="5432"
POSTGRES_DATABASE="DBNAME"
POSTGRES_USER="USER"
POSTGRES_PASSWORD="PASSWORD"
POSTGRES_SSL="true"
NEXT_PUBLIC_QUIE_BASE_URL="https://quie-nfc-platform.vercel.app"
```

`DATABASE_URL` es suficiente para `pg`. Las variables `POSTGRES_*` tambien sirven para integraciones tipo Vercel.

## Next.js con pg

Instala el cliente:

```bash
npm install pg
```

Ejemplo de conexion reusable:

```ts
// lib/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
```

Ejemplo de consulta para landing NFC:

```ts
const { rows } = await pool.query(
  `SELECT c.*, p.nombre AS producto_nombre, p.categoria, p.color, p.descripcion,
          p.imagen_url, l.nombre AS lote_nombre, a.nombre AS artesano_nombre,
          a.ciudad AS artesano_ciudad, a.region AS artesano_region,
          a.especialidad AS artesano_especialidad, a.historia AS artesano_historia,
          a.foto_url AS artesano_foto_url
   FROM codigos c
   LEFT JOIN productos p ON p.id = c.producto_id
   LEFT JOIN lotes l ON l.id = c.lote_id
   LEFT JOIN artesanos a ON a.id = l.artesano_id
   WHERE c.codigo_nfc = $1
   LIMIT 1`,
  [codigoNfc]
);
```

## Next.js con @vercel/postgres

Instala el cliente:

```bash
npm install @vercel/postgres
```

Ejemplo:

```ts
import { sql } from '@vercel/postgres';

const { rows } = await sql`
  SELECT c.*, p.nombre AS producto_nombre
  FROM codigos c
  LEFT JOIN productos p ON p.id = c.producto_id
  WHERE c.codigo_nfc = ${codigoNfc}
  LIMIT 1
`;
```
