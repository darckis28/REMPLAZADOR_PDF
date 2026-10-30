# Folio — Reemplazador de páginas PDF

Aplicación gratuita creada con **Astro + React + TypeScript**, usando **pdf-lib** para reemplazar páginas de PDF y **PDF.js** para mostrar sus miniaturas.

## Funciones

- Subir el PDF original y otro PDF con las páginas que lo sustituirán.
- Mostrar y seleccionar páginas por su miniatura.
- Hacer múltiples reemplazos en el mismo documento, uno tras otro.
- Visualizar las páginas seleccionadas en grande (botón «Ver ampliada»).
- Deshacer los últimos 10 reemplazos y restaurar el documento original.
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

## Indexación en Google

El sitio publica `robots.txt` y `sitemap.xml` desde `public/`. Después de
desplegarlo en `https://cambialo.netlify.app/`, añade el dominio a Google Search
Console y envía `https://cambialo.netlify.app/sitemap.xml` desde la sección
**Sitemaps**. La página principal incluye URL canónica, metadatos para compartir
y datos estructurados.

## Cómo utilizar

1. Arrastra o carga el **PDF original** en el panel izquierdo.
2. Arrastra o carga el **PDF de reemplazo** en el panel derecho.
3. Haz clic en la hoja que quieres quitar en la izquierda.
4. Haz clic en la hoja nueva que quieres poner en la derecha.
5. Pulsa **Reemplazar página**.
6. Puedes repetir los pasos 3 a 5 tantas veces como necesites.
7. Pulsa **Descargar PDF** para guardar el archivo editado.

## Probar con PDFs de ejemplo

En la carpeta `ejemplos/` se incluyen `pdf-original-ejemplo.pdf` (3 páginas) y `pdf-reemplazo-ejemplo.pdf` (2 páginas). Prueba, por ejemplo, reemplazar la página **2** del original con la página **1** del PDF nuevo.

## Detalles importantes

- Las páginas de reemplazo conservan su propio tamaño, por lo que, si los documentos tienen diferentes dimensiones de página, la página insertada puede ser distinta del resto.
- Como en otros editores PDF, la modificación de un PDF con **firma digital** puede invalidar esa firma.
- Algunos archivos PDF protegidos con contraseña, cifrados, dañados o con estructuras especiales no son compatibles con `pdf-lib`.
- Se recomienda trabajar con copias de los originales.
- Límite por archivo: **120 MB** para reducir el riesgo de agotar la memoria del navegador.
- Las tipografías e imágenes de las páginas no se convierten en capturas de pantalla: `pdf-lib` copia el contenido de la página a reemplazar.
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
│   └── pdf.ts                # Carga y reemplazo real de páginas
├── pages/
│   └── index.astro           # Página principal Astro
└── styles/
    └── global.css           # Diseño responsive
```

## Aviso de privacidad

El archivo se lee mediante `File.arrayBuffer()` y se procesa localmente en el navegador. No existe ningún endpoint para subir PDFs. Se solicita Google Fonts para cargar la tipografía de la interfaz (puede reemplazarse por fuentes locales para funcionamiento completamente sin red).

## Licencia

MIT. Puedes modificarlo y publicarlo en tu cuenta de GitHub.
