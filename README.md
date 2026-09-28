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
* **Cuello de botella identificado**: la demora principal está en la venta en la barra (pedir y cobrar), no en la preparación. Servir una bebida lleva poco tiempo; lo que frena la fila es que el bartender tiene que escuchar el pedido, cobrar y dar el vuelto o esperar el posnet. Por eso el sistema saca el pedido y el pago de la barra y los pasa al celular del asistente, dejando en la barra una única fila de retiro donde el pedido ya llega pagado.

## 2. Alcance del Proyecto
* El proyecto consiste en una plataforma web transaccional estructurada bajo el modelo de "Compra Virtual y Retiro Rápido".
* A través del escaneo del QR de acceso del evento, los usuarios podrán acceder al catálogo digital, realizar el pedido, procesar el pago y obtener uno o más tickets digitales de retiro, cada uno con su propio QR.
* El asistente compra sin crear una cuenta. El sistema lo identifica con una cookie que genera el servidor, para que pueda volver a ver sus tickets desde el mismo navegador.
* No hay cola virtual ni cola de preparación: la barra prepara el pedido en el momento del retiro. Para que pueda anticiparse, cuenta con un panel de demanda pendiente (por ejemplo, "34 gin tonic por entregar") que le permite reponer insumos antes de quedarse sin ellos.
* El Producto Mínimo Viable (MVP) abarcará una interfaz para el cliente final, una interfaz simplificada para el personal de barra orientada al escaneo y entrega, y un panel para el organizador donde gestiona catálogos, eventos y staff.
* En esta primera etapa se utilizará un entorno de simulación para los pagos, dejando la integración de pasarelas financieras reales sujeta a la aprobación del tutor o para futuras escalabilidades.
* No habrá preventa: solo se puede comprar mientras el evento está en curso.

## 3. Modelo Funcional
* **Roles**: el **Organizador** (la productora) administra su catálogo maestro, crea eventos y asigna al personal. El **Staff** edita solo el catálogo de su evento y escanea tickets. El **Asistente** compra sin cuenta. Existe además un administrador de la plataforma que se crea por seed.
* **Tipos de QR**:
  * *QR de acceso*: uno fijo por evento, que abre el catálogo de ese evento (no hay QR por mesa o sector). Si el evento todavía no empezó, informa que no está en curso; si el QR no corresponde a ningún evento, se muestra una página de "evento inexistente".
  * *QR de retiro*: uno por ticket. Contiene un token aleatorio de 128 bits que no se puede adivinar, y el ticket muestra además un número corto para que el staff lo identifique a simple vista.
* **Ticket al portador**: lo retira quien muestre el QR. Cada ticket se retira completo y de una sola vez, y eso se avisa antes de pagar. Si el asistente quiere retirar en momentos distintos, puede dividir su compra en varios tickets dentro de un mismo pago.
* **Estados**:
  * *Evento*: PROGRAMADO → EN_CURSO → FINALIZADO, según el horario configurado. Un evento en curso no se puede detener ni borrar; uno que nunca empezó simplemente se elimina.
  * *Pedido*: PENDIENTE_PAGO, con el stock reservado durante 10 minutos.
  * *Pago*: PENDIENTE → APROBADO o RECHAZADO. Si se rechaza o vence el plazo, la reserva de stock se libera.
  * *Ticket*: ACTIVO → RETIRADO, o VENCIDO. La venta cierra en el horario de fin del evento y los tickets se pueden retirar hasta una hora después.
* **Canje**: al escanear, el ticket se marca como retirado en una única operación atómica, por lo que un mismo QR no puede canjearse dos veces aunque se escanee en dos barras a la vez. Un ticket retirado o vencido deja de mostrar su QR.
* **Disponibilidad**: cada evento toma productos del catálogo maestro y define su propio precio, si están disponibles y, opcionalmente, un stock. El stock se reserva antes de cobrar, así nadie paga por algo que ya se agotó. Los productos agotados se muestran en gris como "Agotado". Se pueden pedir hasta 10 unidades por producto en cada ticket, o menos si el stock restante es menor.
* **Precio histórico**: cada ítem del ticket guarda el nombre del producto y el precio unitario al momento de la compra, de modo que un cambio posterior de precio no altera lo ya vendido.
* **Escenario de ejemplo**: un asistente escanea el QR de acceso, elige 2 cervezas, 1 gin tonic y 1 agua, y decide separar el agua en otro ticket. Al confirmar, el sistema reserva el stock y crea el pedido en PENDIENTE_PAGO. Con el pago aprobado se generan dos tickets ACTIVOS y el panel de la barra suma esos productos a la demanda pendiente. En la barra, el staff escanea el primer ticket, ve el detalle (2 cervezas, 1 gin tonic), lo prepara y lo entrega; el ticket pasa a RETIRADO. Más tarde retira el agua con el segundo ticket.

## 4. Clasificación de Funcionalidades por Prioridad
| Categoría | Módulo | Descripción y Funcionalidades |
| :--- | :--- | :--- |
| **MVP** | Cliente (Web App) | Visualización del catálogo del evento, carrito de compras, checkout con pago simulado y generación de tickets con QR de retiro. |
| **MVP** | Barra (Staff Web App) | Lector QR utilizando la cámara del dispositivo que muestra el detalle del ticket y lo marca como "Retirado" al escanearlo. Panel de demanda pendiente. |
| **MVP** | Panel del Organizador | ABM del catálogo maestro, creación de eventos con precio, disponibilidad y stock por producto, y asignación del staff. |
| **Nice to Have** | Integración de Pagos | Implementación de la API de MercadoPago. |
| **Nice to Have** | Métricas Básicas | Visualización en tiempo real de la facturación de la noche y los tres productos más vendidos. |
| **Fuera de Alcance** | Aplicaciones Nativas | No se desarrollarán aplicaciones nativas descargables en móviles. |
| **Fuera de Alcance** | Gestión de Proveedores | El sistema no manejará control de stock complejo ni integración con proveedores; el stock por evento es un número opcional que solo limita la venta. |

## 5. Stack Tecnológico y Arquitectura Cloud
* **Frontend**: Next.js con TypeScript. Su renderizado optimizado ayuda a que el catálogo cargue rápido al escanear el QR, algo importante para la UX durante el evento. El frontend será desplegado en Vercel para aprovechar el CDN global y el deploy continuo.
* **Backend (API Rest)**: NestJS con TypeScript. Ofrece una arquitectura modular y tipada. Su entorno Node.js maneja bien la asincronía, lo que le permite atender varias peticiones de compra simultáneas sin bloquear el servidor. Será alojado en Railway.
* **Base de Datos**: PostgreSQL. Es un motor relacional con soporte de transacciones, que usamos para que la reserva de stock y el canje de tickets se hagan de forma atómica, con una estructura de datos predecible y fácil de mantener respecto a motores NoSQL.
* **Infraestructura Interna**: La base de datos y el backend estarán configurados dentro del mismo entorno de proyecto en Railway, lo que reduce la latencia de la conexión interna y facilita el despliegue automático desde GitHub.
* **Concurrencia**: como objetivo de diseño tomamos un evento de hasta 1.500 asistentes, con un pico de 100 compras por minuto. No es un límite garantizado sino la carga con la que vamos a probar el sistema. La consistencia bajo carga no depende de la velocidad del servidor sino de que la reserva de stock y el canje se resuelvan como operaciones atómicas en PostgreSQL: aunque dos personas compren la última unidad o dos barras escaneen el mismo QR al mismo tiempo, solo una operación se concreta.

## 6. Control de Versiones y Auditoría
* Todo el código fuente del proyecto se gestionará utilizando Git. 
* El repositorio de GitHub actuará como fuente oficial para la auditoría del trabajo colaborativo, la revisión de ramas y el seguimiento constante de commits por parte de la cátedra y el tutor.
