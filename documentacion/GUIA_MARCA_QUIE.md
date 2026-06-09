# Guia de marca QUIE

Fuente visual revisada:

- `logos y marcas/logos y aplicaciones/quie.png`: logo principal con simbolo superior y wordmark.
- `logos y marcas/logos y aplicaciones/completa.png`: tablero de concepto, paleta, tipografias, usos y aplicaciones.
- `logos y marcas/logos y aplicaciones/marketing.txt`: estrategia de tono, campanas, producto, NFC y posicionamiento.

## Concepto

QUIE es una marca colombiana de accesorios de lujo inspirada en la tierra, el oficio artesanal y el diseno contemporaneo.

Ideas centrales:

- Tierra: origen, naturaleza, materiales nobles, conexion con Colombia.
- Manos: oficio artesanal, detalle, piezas hechas con intencion.
- Tiempo: piezas duraderas, elegantes y atemporales.

Frase principal:

> Elegancia con raiz.

Tagline operativo:

> De la tierra. Para siempre.

## Tono

La marca debe sentirse elegante, silenciosa, artesanal, calida, exclusiva y consciente.

Usar:

- Lenguaje sobrio y premium.
- Frases cortas con raiz cultural.
- Mensajes sobre origen, material, oficio, autenticidad y durabilidad.

Evitar:

- Promociones agresivas.
- Estetica folclorica literal o de souvenir.
- Iconografia indigena literal sin investigacion.
- Colores saturados o decoracion excesiva.
- Mensajes tipo "mega descuento", "aprovecha ya" o similares.

## Paleta oficial

Primaria:

- Verde profundo: `#2D402E`
- Arena dorada: `#D9A86C`
- Marfil claro: `#F2F2F2`

Secundaria:

- Terracota: `#BF5630`
- Cuero oscuro: `#593325`
Usa verde profundo y cuero oscuro para contraste; evita negro puro fuera de assets externos.

## Tipografias

Referencia visual del brand board:

- Titulos: Playfair Display o una serif elegante equivalente.
- Textos: Montserrat o una sans limpia equivalente.
- Frases cortas: mayusculas con espaciado moderado.

## Uso del logo

Versiones:

- Principal: simbolo superior + wordmark QUIE. Usar en landing, home, empaque principal y certificados.
- Horizontal: simbolo pequeno a la izquierda + QUIE a la derecha. Usar en headers, banners y firmas.
- Isotipo: simbolo geometrico. Usar en favicon, NFC tags, remaches, sellos, stickers y pequenos espacios.
- Monocromatica: una tinta en arena dorada, terracota, verde profundo o cuero oscuro. Usar para cuero, grabado, bajo relieve, foil y sellos.

Reglas:

- No usar iconos de marca anteriores.
- No agregar sombras fuertes, degradados pesados ni efectos neon.
- Para cuero o grabado, usar version de una tinta.
- En UI, usar el logo sobre fondo marfil claro, arena dorada suave o verde profundo con suficiente aire.

## Linea grafica

Usar:

- Mucho espacio en blanco o marfil.
- Fondos de piedra, lino, arcilla, madera y cuero.
- Fotografias limpias de producto.
- Macros de textura, costuras, herrajes y manos trabajando.
- Patrones geometricos reinterpretados de forma abstracta.

Evitar:

- Fondos saturados.
- Fotos sobrecargadas.
- Decoracion generica.
- Gradientes dominantes sin relacion con materialidad.

## Aplicaciones digitales

Landing publica:

- Primer viewport debe mostrar QUIE de forma clara con logo o wordmark.
- Hero sobrio con producto o textura real.
- CTA recomendado: "Descubrir coleccion" o "Verificar autenticidad".
- Mensaje base: "Accesorios de lujo colombiano inspirados en la tierra."

Experiencia NFC:

- Debe mostrar logo QUIE, certificado de autenticidad, numero de serie y datos de origen.
- Secciones esperadas: Origen, Material, Hecho en Colombia, Fecha de creacion, Serie, Cuidado.
- El estado autenticado debe sentirse premium, no tecnico ni alarmista.

Modulo "El Origen" (/origen):

- Historia poetica fundacional de QUIE®. Se activa al primer escaneo NFC.
- La animacion typewriter (40ms/caracter) corre UNA SOLA VEZ por dispositivo.
- Se controla con localStorage key: `quie_origin_seen = true`.
- Despues de verla, el texto aparece completo sin animacion (experiencia de regreso).
- Para forzar replay en demos: /origen?replay=1
- Accesible permanentemente desde: nav principal, footer del sitio y pagina de autenticidad NFC.
- Archivo: web/origen.html — sin dependencias externas, vanilla JS puro.
- La animacion NO debe resetearse automaticamente. Es una experiencia de primer contacto con la marca.

Panel admin:

- Debe ser utilitario y denso, pero mantener paleta QUIE.
- Usar isotipo pequeno en topbar.
- Evitar hero marketing dentro del admin.

## Productos iniciales

Prioridad de catalogo:

- Tarjetero premium.
- Billetera minimalista.
- Llavero NFC.
- Correa elegante.
- Porta documentos.
- Bolso mini.

Categorias amplias del proyecto:

- Bolsos.
- Billeteras.
- Morrales.
- Carteras.
- Cinturones.
- Maletines ejecutivos.

## NFC y autenticidad

Formato de lote:

```text
QUIE-[CATEGORIA]-[AÑO]-[SEC]
```

Ejemplo:

```text
QUIE-BOL-2025-001
```

Formato NFC:

```text
QUIE-[6ALNUM]-[CHECKSUM]
```

Ejemplo:

```text
QUIE-A7B3X9-42
```

Mensaje recomendado:

> Cada pieza QUIE puede contar su propia historia. Escanea, descubre su origen y verifica su autenticidad.

## Checklist para nuevas pantallas

- Usa logo desde `logos y marcas/`.
- Usa paleta oficial o secundaria autorizada.
- Titulos con serif elegante, textos con sans limpia.
- No usa referencias visuales ni textuales de marcas anteriores.
- No usa categorias heredadas de marcas anteriores.
- Mantiene lujo silencioso, raiz colombiana y autenticidad NFC.
