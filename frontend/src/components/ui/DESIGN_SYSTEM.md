# EduLink — Design System interno

Guía corta de lo que ya es estándar en el proyecto, para que cualquier módulo nuevo (Biblioteca,
Inventario, BTH, Transporte, Secretaría, Configuración, ...) se vea y se comporte igual sin tener que
rediseñar cada pantalla. Nada de esto es nuevo — es lo que el proyecto ya usa de forma consistente,
ahora documentado y con componentes para dejar de copiarlo a mano.

## Color

El color de marca de cada panel (Junta Escolar, Admin, Plantel Docente, Estudiantes) se define una sola
vez por panel en su `layout.tsx` (prop `theme` de `DashboardShell`) y se propaga vía custom properties
(`--dsh-primary`, `--dsh-navbar`, `--dsh-accent`, `--dsh-hover`, `--dsh-bg`). Un módulo nuevo **no elige
colores** — hereda el tema del panel donde vive.

Estados semánticos (Éxito/Pendiente/Error/Advertencia) = tonos de `Badge`, no un componente aparte:

| Tono      | Uso                                  |
|-----------|---------------------------------------|
| `success` | Éxito, al día, activo, pagado         |
| `warning` | Pendiente, deudor, advertencia        |
| `danger`  | Error, vencido, inactivo, rechazado   |
| `info`    | Informativo, neutral-destacado        |
| `neutral` | Sin estado / dato secundario          |
| `brand`   | Categoría o tipo (no un estado)       |

## Tipografía

| Tamaño        | Uso                                          |
|---------------|-----------------------------------------------|
| 11–11.5px     | Labels en mayúscula, hints, notas al pie      |
| 12–12.5px     | Texto de celda de tabla, subtítulos de fila   |
| 13–13.5px     | Cuerpo de texto, nav, botones                 |
| 15–16px       | Íconos de contenido, títulos de tarjeta       |
| 18–20px (`text-xl`) | Título de página (`PageHeader`)         |

## Iconografía

Una sola librería: `lucide-react`. Tamaños ya estandarizados: 12–13px (dentro de botones/chevrons),
14–17px (nav, headers de sección), 20px (menú mobile), 40px (ilustración de `EmptyState`).

## Espaciado

Escala ya en uso, no se agregan valores nuevos: `gap-1.5 / 2 / 2.5 / 3 / 4`, `p-2 / 3 / 4 / 5`,
`mb-4 / 6`.

## Componentes

Base (sin cambios, ya existían): `Button`, `Card`/`CardHeader`/`CardTitle`, `Badge`, `Input`/`Select`/
`Textarea`, `Table`, `Modal`, `ToastProvider`/`useToast`, `ConfirmProvider`/`useConfirm`.

Nuevos, para dejar de copiar a mano el mismo bloque en cada página:

- **`PageHeader`** — encabezado de página (ícono + título + descripción + acción principal opcional).
- **`Toolbar`** — barra de búsqueda + filtros + acciones + selector de vista, configurada por objeto.
- **`useModuleFilters`** — persiste los filtros elegidos en un módulo (`sessionStorage`) mientras el
  usuario navega entre sus páginas.
- **`Popover`** / **`Drawer`** — panel flotante / panel deslizante lateral-inferior, usados por
  `Toolbar` para "Más filtros" (Popover en escritorio/tablet, Drawer en mobile).
- **`StatCard`** — tarjeta de indicador (KPI).
- **`EmptyState`** / **`LoadingState`** — estado vacío / estado de carga.
- **`Breadcrumb`** — migas de pan bajo el segundo nivel de navegación.
- **`Pagination`** — paginación de tablas largas (100% en cliente, sobre datos ya traídos).
- **`AppHeader`** / **`ModuleNavigation`** — Nivel 1 y Nivel 2 del header (uso interno de
  `DashboardShell`, no se usan sueltos en una página).

## Formularios

No hay un componente "Form" — la convención del proyecto es: `Input`/`Select`/`Textarea` (con su label
incluido) dentro de un `Modal` con `footer` para los botones de acción. Así están armados todos los
formularios de creación/edición existentes; los módulos nuevos siguen el mismo patrón.

## Responsive

- **Desktop** (>1024px): todo visible.
- **Tablet** (861–1024px): `Toolbar` oculta acciones secundarias detrás de un menú "···" y muestra menos
  filtros inline antes de pasar a "Más filtros".
- **Mobile** (≤860px, mismo breakpoint que ya usa `DashboardShell` para el menú hamburguesa): los
  filtros de `Toolbar` se abren en `Drawer` (bottom sheet) en vez de mostrarse en fila.
