# Aurora PostgreSQL

Migraciones base para QUIE NFC Platform.

## Orden de ejecucion

```bash
psql "$DATABASE_URL" -f database/aurora/001_init.sql
psql "$DATABASE_URL" -f database/aurora/002_seed_demo.sql
```

`002_seed_demo.sql` solo debe usarse en entornos locales, previews o demos del hackathon. Todos los datos insertados estan marcados como `[DEMO]`.

## Modelo

- `productos`: catalogo comercial de accesorios QUIE.
- `lotes`: lotes de produccion con formato `QUIE-[CATEGORIA]-[AÑO]-[SEC]`.
- `codigos`: codigos NFC unicos con formato `QUIE-[6ALNUM]-[CHECKSUM]`.
- `clientes`: registro opcional de propietario post-escaneo.
- `auditoria`: eventos administrativos relevantes.

Los eventos de escaneo de alto volumen van en DynamoDB (`escaneos`) y se enlazan por `codigo_id` o `codigo_nfc` desde la capa de aplicacion.
