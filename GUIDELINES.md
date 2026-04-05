# 📜 Golden Rules of Development - ClubManager Pro

> **Propósito:** Garantizar la integridad del sistema, la consistencia visual y la estabilidad de la base de datos en entornos de producción (Vercel/Supabase).

---

## 1. 🗄️ Convención de Nomenclatura de Base de Datos (Hybrid Model)
Para evitar errores **400 (Bad Request)**, se debe respetar estrictamente el modelo híbrido actual. PostgreSQL es *case-insensitive* por defecto, por lo que las columnas con mayúsculas **deben** ir entre comillas dobles en el SQL.

### **Regla de Oro:**
*   **snake_case:** Únicamente para tablas y campos de sistema/auditoría (`updated_at`, `created_at`, `logo_url`, `primary_color`, `member_id`).
*   **camelCase:** Para todos los campos que mapean directamente a las interfaces de TypeScript/UI (`birthDate`, `photoUrl`, `overallRating`, `tournamentId`, `homeTeam`).
*   **SQL Syntax:** Al crear o modificar columnas camelCase, usa siempre comillas: `ALTER TABLE members ADD COLUMN "newField" TEXT;`.

---

## 2. 🎨 Arquitectura de Componentes y Estilo Visual
La App utiliza un estilo **"Premium Dark Editorial"**. No se deben introducir componentes que rompan esta estética.

*   **Tailwind First:** Prohibido el uso de CSS plano o inline styles.
*   **Dark Mode:** Todo componente debe verse perfecto en `dark` mode. Usa clases como `dark:bg-slate-900` and `dark:text-white`.
*   **Tipografía:** Los encabezados de sección deben ser `font-black uppercase italic tracking-tighter`.
*   **Iconografía:** Usa exclusivamente `lucide-react`. Mantén un `strokeWidth` consistente (ej: 2).
*   **Feedback Visual:** Todo botón de acción (Guardar/Eliminar) debe tener un estado de `loading` o un cambio visual inmediato para evitar doble clic.

---

## 3. ⚡ Gestión de Estados y Supabase (Anti-Crash)
Para evitar que la app crashee en Vercel por datos nulos o latencia:

*   **Optional Chaining:** Usa siempre `data?.property` al renderizar datos de Supabase.
*   **Tipado Estricto:** No uses `any`. Si una función recibe un miembro, usa el tipo `Member` de `types.ts`.
*   **Manejo de Errores:** Toda llamada a Supabase en `lib/supabase.ts` debe estar envuelta en un bloque `try/catch` o manejar el objeto `{ data, error }`.
*   **Filtros de Categoría:** Al filtrar por disciplina o categoría, siempre verifica que el array de origen no sea `undefined` (`disciplines.map(...)`).
*   **Keep-Alive:** No modifiques la lógica de `maintenance.ping()` en `App.tsx`; es vital para evitar que el servidor de Supabase entre en modo pausa por inactividad.

---

## 4. 📖 Diccionario de Datos Críticos
Es fundamental no confundir las entidades para mantener la lógica de negocio:

| Tabla | Significado / Uso |
| :--- | :--- |
| `club_config` | **Cerebro del Club.** Contiene colores, logo y la definición de Disciplinas/Categorías. |
| `members` | **Entidad Humana.** Es el socio, staff o jugador como persona (DNI, Teléfono, Tutor, Dirección). |
| `players` | **Entidad Deportiva.** Contiene la ficha técnica (Posición, Dorsal, Rating, Estadísticas). |
| `fees` | **Entidad Financiera.** Registro de deudas y pagos vinculados a un `member_id`. |
| `tournaments` | **Entidad Competitiva.** Define la estructura de un torneo (Grupos, Playoff, Disciplina). |

---

## 5. 🛠️ Protocolo de Modificación Quirúrgica
Antes de realizar cualquier cambio en el código existente:

1.  **Prohibición de Borrado:** Está prohibido eliminar lógica de filtrado existente (`.eq()`, `.order()`) o políticas de RLS sin una justificación de arquitectura.
2.  **Preservación de RLS:** Si añades una tabla, **debes** añadir su política de `ENABLE ROW LEVEL SECURITY` y su política de `Public Access` (o autenticada).
3.  **Mapeo de Tipos:** Si añades una columna en SQL, debes añadirla inmediatamente en `types.ts`.
4.  **Verificación de Nulos:** Al añadir nuevas funciones de lectura, asegura que el componente que las consume maneje el estado de "Cargando" (`isLoading`) para evitar errores de renderizado.

---

## 6. 🚀 Checklist de Despliegue (Vercel)
Antes de dar por finalizada una tarea:
*   [ ] ¿Las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están configuradas?
*   [ ] ¿El SQL fue ejecutado en el editor de Supabase?
*   [ ] ¿Se probó el guardado de datos en una ventana de incógnito?

---

**Arquitecto de Software Senior**
*Proyecto: ClubManager Pro*
