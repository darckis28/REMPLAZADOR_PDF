# Folio — Reemplazador e insertador de páginas PDF

Aplicación gratuita creada con **Astro + React + TypeScript**, usando **pdf-lib** para reemplazar o agregar páginas PDF y **PDF.js** para mostrar sus miniaturas.

## Funciones

- Subir el PDF original y, cuando haga falta, otro PDF con las páginas nuevas.
- Mostrar y seleccionar páginas por su miniatura.
- Hacer múltiples reemplazos en el mismo documento, uno tras otro.
- **Agregar hojas desde otro PDF** antes o después de cualquier página del original, incluida la última.
- **Agregar hojas en blanco** sin necesitar un segundo archivo; heredan el tamaño de la página seleccionada.
- Actualizar automáticamente las miniaturas y la numeración cuando cambie la cantidad de páginas.
- Visualizar las páginas seleccionadas en grande (botón «Ver ampliada»).
- Deshacer los últimos 10 cambios (según memoria disponible) y restaurar el documento original.
- Descargar el PDF final; conserva las demás páginas sin rasterizarlas.
- Funciona completamente en el **navegador**. No envía documentos a un servidor.
- Diseño oscuro y responsive para PC y teléfono.

## Requisitos

- Node.js **22.12 o superior**.
- npm (incluido con Node.js).
- Conexión a Internet **solo para instalar las dependencias**.

## Instalación

```bash
npm install
npm run dev
```

Abre la dirección local mostrada en la terminal, normalmente `http://localhost:4321`.

## Publicar en Netlify o Cloudflare Pages

```bash
npm run build
```

- **Build command:** `npm run build`
- **Publish directory:** `dist`

No se necesita backend ni clave de API.

## Cómo reemplazar una hoja

1. Arrastra o carga el **PDF original** en el panel izquierdo.
2. Arrastra o carga el **PDF de reemplazo** en el panel derecho.
3. Selecciona **Reemplazar hoja** en «¿Qué quieres hacer?».
4. Haz clic en la hoja que quieres quitar en la izquierda y en la hoja nueva que quieres poner en la derecha.
5. Pulsa **Reemplazar página**.
6. Puedes repetir los pasos 3 a 5 tantas veces como necesites.
7. Pulsa **Descargar PDF** para guardar el archivo editado.

## Cómo agregar una hoja

1. Carga el **PDF original** en el panel izquierdo.
2. En «¿Qué quieres hacer?», selecciona **Agregar hoja**.
3. En «¿Qué hoja agregar?» elige:
   - **Desde otro PDF:** carga un segundo PDF y selecciona la hoja que se copiará.
   - **Hoja en blanco:** agrega una página vacía sin necesidad de otro PDF.
4. Selecciona una página del documento de la izquierda como referencia.
5. Elige si quieres insertar la nueva hoja **antes** o **después** de esa página.
6. Pulsa **Agregar hoja**. La nueva hoja aparecerá en las miniaturas y se seleccionará automáticamente.
7. Puedes seguir reemplazando o insertando hojas; luego pulsa **Descargar PDF**.

## Probar con PDFs de ejemplo

En la carpeta `ejemplos/` se incluyen `pdf-original-ejemplo.pdf` (3 páginas) y `pdf-reemplazo-ejemplo.pdf` (2 páginas). Prueba, por ejemplo, reemplazar la página **2** del original con la página **1** del PDF nuevo, o añadirla después de la página **2**. En este último caso, el PDF final tendrá **4 páginas**.

## Detalles importantes

- Las páginas nuevas tomadas de otro PDF conservan su propio tamaño, por lo que, si los documentos tienen diferentes dimensiones, la página insertada puede ser distinta del resto.
- Las hojas vacías usan el tamaño de la página del documento original seleccionada como referencia.
- Como en otros editores PDF, la modificación de un PDF con **firma digital** puede invalidar esa firma.
- Algunos archivos PDF protegidos con contraseña, cifrados, dañados o con estructuras especiales no son compatibles con `pdf-lib`.
- Se recomienda trabajar con copias de los originales.
- Límite por archivo: **120 MB** para reducir el riesgo de agotar la memoria del navegador.
- Las tipografías e imágenes de las páginas no se convierten en capturas de pantalla: `pdf-lib` copia el contenido de las páginas usadas para reemplazar o insertar.
- Deshacer mantiene hasta 10 versiones recientes (o menos para PDFs grandes) para limitar el uso de memoria. «Restaurar» vuelve al PDF original cargado.

## Estructura del proyecto

```
src/
├── components/
│   ├── PdfPageReplacer.tsx   # Estado, carga, acciones, descarga
│   ├── PdfPanel.tsx          # Paneles de archivos y cuadrícula
│   ├── PdfThumbnail.tsx      # Miniaturas con PDF.js
│   └── PdfLargePreview.tsx   # Vista ampliada
├── lib/
│   └── pdf.ts                # Carga, reemplazo e inserción real de páginas
├── pages/
│   └── index.astro           # Página principal Astro
└── styles/
    └── global.css           # Diseño responsive
```

## Aviso de privacidad

El archivo se lee mediante `File.arrayBuffer()` y se procesa localmente en el navegador. No existe ningún endpoint para subir PDFs. Se solicita Google Fonts para cargar la tipografía de la interfaz (puede reemplazarse por fuentes locales para funcionamiento completamente sin red).

## Licencia

MIT. Puedes modificarlo y publicarlo en tu cuenta de GitHub.
