**Trabajo Final Integrador - Tecnicatura Universitaria en Programación**

# Sistema ágil de compra en barras de eventos

* **Equipo de Trabajo**: Javier Isaias Ovelar y Gastón Paschetta
* **Tutor Asignado**: Oscar Londero.
* **Repositorio Oficial**: https://github.com/paschedev/DrinkoWebApp

## 1. Definición del Problema
* La experiencia de compra de bebidas en barras de eventos masivos y discotecas presenta un alto nivel de fricción.
* Los asistentes enfrentan largas filas, demoras en los pagos y dificultades para comunicarse con el personal de barra debido a la contaminación auditiva y al gran movimiento del entorno.
* Esto genera una mala experiencia de usuario, haciendo que el cliente pierda tiempo de ocio esperando ser atendido, no logre consultar el catálogo con claridad e incluso se sienta apurado al ordenar.
* Para los organizadores, esta ineficiencia operativa se traduce en una pérdida significativa de ingresos a causa de los cuellos de botella que limitan el volumen de ventas por hora.

## 2. Alcance del Proyecto
* El proyecto consiste en una plataforma web transaccional estructurada bajo el modelo de "Compra Virtual y Retiro Rápido".
* A través de un escaneo de código QR en la mesa o sector, los usuarios podrán acceder al catálogo digital, realizar el pedido, procesar el pago y generar un ticket digital único (QR de retiro).
* El Producto Mínimo Viable (MVP) abarcará una interfaz para el cliente final, una interfaz simplificada para el personal de barra orientada al escaneo y entrega, y un panel de administración básico para gestionar el catálogo.
* En esta primera etapa se utilizará un entorno de simulación para los pagos, dejando la integración de pasarelas financieras reales sujeta a la aprobación del tutor o para futuras escalabilidades.

## 3. Clasificación de Funcionalidades por Prioridad
| Categoría | Módulo | Descripción y Funcionalidades |
| :--- | :--- | :--- |
| **MVP** | Cliente (Web App) | Visualización de catálogo de bebidas, carrito de compras, checkout y generación de QR único de retiro. |
| **MVP** | Barra (Staff Web App) | Lector QR utilizando la cámara del dispositivo e interfaz de un solo toque para marcar pedidos como "Entregados" e invalidar el QR. |
| **MVP** | Dashboard Admin | ABM de productos y precios en el catálogo. |
| **Nice to Have** | Integración de Pagos | Implementación de la API de MercadoPago. |
| **Nice to Have** | Métricas Básicas | Visualización en tiempo real de la facturación de la noche y los tres productos más vendidos. |
| **Fuera de Alcance** | Aplicaciones Nativas | No se desarrollarán aplicaciones nativas descargables en móviles. |
| **Fuera de Alcance** | Gestión de Proveedores | El sistema no manejará control de stock complejo ni integración con proveedores. |

## 4. Stack Tecnológico y Arquitectura Cloud
* **Frontend**: Next.js con TypeScript. Su capacidad de renderizado optimizado asegura tiempos de carga casi instantáneos al escanear los QR, un factor clave para la UX durante el evento. El frontend será desplegado en Vercel para aprovechar el CDN global y el deploy continuo.
* **Backend (API Rest)**: NestJS con TypeScript. Ofrece una arquitectura modular, escalable y tipada. Su entorno Node.js maneja la asincronía de forma ideal para procesar múltiples peticiones de compra simultáneas sin bloquear el servidor. Será alojado en Railway.
* **Base de Datos**: PostgreSQL. Es un motor relacional robusto que asegura la integridad de las transacciones de las compras y pagos, contando con una estructura de datos predecible y fácil de mantener respecto a motores NoSQL. 
* **Infraestructura Interna**: La base de datos y el backend estarán configurados dentro del mismo entorno de proyecto en Railway para asegurar una latencia cero de conexión interna y facilitar el despliegue automático desde GitHub.

## 5. Control de Versiones y Auditoría
* Todo el código fuente del proyecto se gestionará utilizando Git. 
* El repositorio de GitHub actuará como fuente oficial para la auditoría del trabajo colaborativo, la revisión de ramas y el seguimiento constante de commits por parte de la cátedra y el tutor.
