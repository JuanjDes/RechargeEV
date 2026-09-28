# Contexto para agentes de IA

Este archivo contiene instrucciones generales para cualquier agente de IA que trabaje sobre el proyecto RechargeEV.

## Objetivo general

RechargeEV es una aplicación web/PWA orientada a gestionar tareas de recarga de vehículos eléctricos durante una jornada de trabajo.

La aplicación debe priorizar:

- simplicidad de uso;
- funcionamiento correcto en móvil;
- rapidez de operación;
- fiabilidad;
- seguridad;
- facilidad de mantenimiento.

## Forma de trabajar

Antes de modificar código:

1. Leer `README.md`.
2. Leer la documentación disponible en `docs/`.
3. Revisar la estructura actual del proyecto.
4. Comprobar el estado de Git.
5. Entender primero la funcionalidad existente antes de sustituirla o refactorizarla.

No asumir que una funcionalidad está pendiente únicamente porque no aparezca descrita en la documentación. El código actual es la principal fuente de verdad.

## Reglas generales

- No eliminar funcionalidades existentes sin una razón clara.
- Evitar cambios masivos cuando una modificación pequeña sea suficiente.
- Mantener el código sencillo y comprensible.
- Evitar dependencias externas innecesarias.
- No introducir frameworks o librerías nuevas sin justificar su utilidad.
- Mantener compatibilidad con dispositivos móviles.
- Preservar el funcionamiento como PWA.
- No modificar nombres, estructuras o APIs existentes sin comprobar previamente sus dependencias.
- Evitar duplicar lógica.
- Mantener separadas, cuando sea posible, la interfaz, la lógica de negocio y el acceso a datos.

## Seguridad

El código generado debe seguir prácticas seguras.

Especialmente:

- validar datos introducidos por el usuario;
- evitar insertar directamente contenido no confiable en el DOM;
- evitar `innerHTML` cuando pueda usarse `textContent` u otras alternativas seguras;
- validar parámetros recibidos por el backend;
- no almacenar secretos, tokens o claves API directamente en el código;
- utilizar variables de entorno para credenciales;
- evitar exponer información sensible en mensajes de error;
- revisar nuevas dependencias antes de incorporarlas.

## Git

Antes de realizar cambios importantes:

- comprobar `git status`;
- evitar modificar archivos no relacionados con la tarea;
- mantener los cambios lo más acotados posible.

No ejecutar acciones destructivas como:

```bash
git reset --hard
git clean -fd
git push --force
```

salvo que el usuario lo solicite explícitamente.

## Pruebas y comprobaciones

Después de realizar cambios:

- comprobar que la aplicación sigue arrancando correctamente;
- revisar errores de consola;
- ejecutar las pruebas existentes, si las hay;
- comprobar que no se hayan roto funcionalidades relacionadas;
- revisar el `git diff` antes de considerar terminada una tarea.

Si no existen pruebas automatizadas para una funcionalidad importante, valorar añadirlas.

## Desarrollo móvil y PWA

RechargeEV está pensado principalmente para su utilización desde un teléfono móvil.

Por tanto:

- priorizar diseño responsive;
- evitar interfaces que requieran demasiados pasos;
- mantener botones y controles cómodos para pantallas táctiles;
- preservar `manifest.json` y `service-worker.js`;
- comprobar que los cambios no interfieran con la instalación o funcionamiento de la PWA.

## Optimización de rutas y recargas

El proyecto puede incluir lógica relacionada con vehículos, puntos de carga y planificación de rutas.

Al modificar esta parte:

- mantener separadas las reglas de negocio de la interfaz;
- documentar los supuestos utilizados por los algoritmos;
- evitar valores importantes escritos directamente en el código si pueden convertirse en configuración;
- hacer que parámetros como distancias máximas, tiempos o capacidades puedan modificarse fácilmente.

Los algoritmos deben priorizar soluciones prácticas para el trabajo real, no únicamente soluciones matemáticamente óptimas.

## Documentación

Cuando un cambio modifique de forma relevante el comportamiento o arquitectura del proyecto, actualizar la documentación correspondiente dentro de `docs/`.

En particular:

- `arquitectura.md`: estructura y funcionamiento técnico;
- `estado-proyecto.md`: funcionalidades terminadas, pendientes o en desarrollo;
- `decisiones.md`: decisiones importantes y motivos.

## Comunicación

Cuando exista más de una solución razonable:

- explicar brevemente las alternativas;
- indicar ventajas e inconvenientes;
- evitar realizar una refactorización grande sin necesidad.

Si una petición puede provocar pérdida de datos, romper compatibilidad o cambiar significativamente la arquitectura, advertirlo antes de ejecutar el cambio.

## Principio general

Preferir siempre:

**cambios pequeños, comprensibles, seguros y verificables**

frente a:

**reescrituras grandes o innecesariamente complejas**.