# TagWriter — Guía Maestra de Programación NFC
## QUIE® | Chip: NTAG213

---

## ESPECIFICACIONES DEL CHIP

| Parámetro | Valor |
|-----------|-------|
| **Chip** | NTAG213 |
| **Capacidad total** | 144 bytes |
| **Capacidad útil NDEF** | 137 bytes |
| **Frecuencia** | 13.56 MHz (ISO 14443A) |
| **Rango de lectura** | 1–10 cm |
| **Compatibilidad** | Android 4.0+ · iOS 11+ (iPhone 7 en adelante) |
| **Formato a escribir** | NDEF URI record |
| **URL máxima** | 132 caracteres → usar `QUIE®.com/v/[CODIGO]` |

---

## APPS RECOMENDADAS

### Para escribir (operador de producción QUIE):
| App | Sistema | Gratuita |
|-----|---------|----------|
| **NFC Tools Pro** | Android / iOS | No (vale la pena) |
| **NFC TagWriter by NXP** | Android | OK Sí |
| **NFC.cool Tools** | iOS | OK Sí |

### Para verificar (control de calidad):
- **NFC Tools** (leer y confirmar URL escrita)
- **Teléfono directamente** (acercar al tag — debe abrir el navegador)

---

## PROCESO PASO A PASO — OPERADOR QUIE

### ANTES DE EMPEZAR
- [ ] Tener el CSV del lote abierto (columna `url_landing`)
- [ ] Instalar NFC TagWriter by NXP o NFC Tools Pro
- [ ] Cargar el teléfono al 100% (la escritura NFC consume batería)
- [ ] Trabajar en mesa plana, sin interferencias metálicas
- [ ] Tener los tags NFC organizados en el mismo orden que el CSV

---

### PASO 1 — Abrir la app de escritura

**En NFC TagWriter by NXP (Android):**
1. Abrir la app
2. Tocar **"Write tags"**
3. Seleccionar **"New dataset"**
4. Tocar **"URI"**
5. En el campo URL pegar: `https://QUIE®.com/v/[CODIGO]`
   - Ejemplo: `https://QUIE®.com/v/QUIE-A7B3X9-42`
6. Tocar **"Save & write"**

**En NFC Tools Pro:**
1. Ir a pestaña **"Write"**
2. Tocar **"Add a record"** → **"URL/URI"**
3. Pegar la URL completa
4. Tocar **"Write / 1 tag"**

---

### PASO 2 — Escribir el tag

1. Acercar el tag NFC al lector del teléfono (zona posterior, centro o parte superior según modelo)
2. Mantener el teléfono **quieto y plano** sobre el tag durante 1–2 segundos
3. Esperar la confirmación de la app: **"Tag written successfully"** OK
4. Si falla: volver a intentar — no mover el teléfono mientras escribe

> Atención: Si el tag no responde después de 3 intentos, puede ser un tag defectuoso. Separar y reportar.

---

### PASO 3 — Verificar inmediatamente

1. Cerrar la app de escritura
2. Acercar el mismo tag al teléfono con NFC activado
3. Debe aparecer la notificación del navegador con la URL de autenticidad QUIE
4. Confirmar que la URL corresponde al código correcto del CSV
5. Marcar ese tag como OK verificado en la lista

---

### PASO 4 — BLOQUEO (Anti-falsificación)

Una vez verificado, **bloquear el tag** para que nadie pueda sobreescribir la URL:

**En NFC Tools Pro:**
1. Leer el tag → tocar **"More options"** → **"Make read-only"**
2. Confirmar — esta acción es **IRREVERSIBLE**

**En NFC TagWriter by NXP:**
1. Ir a **"Other functions"** → **"Lock tag"**
2. Confirmar bloqueo

> Atención: BLOQUEAR solo después de verificar que la URL es correcta. Un tag bloqueado con URL incorrecta debe descartarse.

---

### PASO 5 — Colocar el tag en la pieza

**Posición recomendada:**
- Interior de la pieza, en la **zona interior discreta** (zona frontal interior)
- Pegado con adhesivo fuerte (si el tag no tiene adhesivo propio: cinta doble faz industrial)
- Evitar zona de costuras metálicas (interfieren con la señal)
- El tag debe quedar **plano** y sin arrugas

**Alternativa:** Bajo la etiqueta de talla/marca interior

---

## CHECKLIST POR TAG — IMPRIMIR Y USAR

```
LOTE: _______________    FECHA: _______________

[ ] Tag #___  URL: QUIE®.com/v/____________  Escrito OK  Verificado OK  Bloqueado OK  Pegado OK
[ ] Tag #___  URL: QUIE®.com/v/____________  Escrito OK  Verificado OK  Bloqueado OK  Pegado OK
[ ] Tag #___  URL: QUIE®.com/v/____________  Escrito OK  Verificado OK  Bloqueado OK  Pegado OK
```

---

## RESOLUCIÓN DE PROBLEMAS

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| Tag no detectado | NFC desactivado | Activar NFC en ajustes del teléfono |
| Error de escritura | Tag ya bloqueado | Descartar tag, usar uno nuevo |
| URL incorrecta escrita | Error en copy/paste | Leer tag, verificar URL, sobreescribir si no está bloqueado |
| Tag abre página de error | URL no existe aún | Esperar activación en sistema o verificar código |
| Tag defectuoso | Chip dañado | Separar y reportar a NEXO |

---

## RENDIMIENTO ESPERADO

- Tiempo por tag: ~15 segundos (escribir + verificar + bloquear)
- 50 tags ≈ 12–15 minutos de trabajo continuo
- 100 tags ≈ 25–30 minutos

---

*TagWriter — QUIE® NFC System v1.0 · 2026*
