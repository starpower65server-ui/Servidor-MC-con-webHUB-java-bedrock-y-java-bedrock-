================================================================================
          GUÍA COMPLETA Y FUNCIONAMIENTO — MINECRAFT SERVER MANAGER
================================================================================

Este documento explica de forma sencilla y paso a paso qué es este proyecto,
cómo se pone en marcha, cómo crear servidores para Java y Bedrock, y cómo 
configurar tu dominio propio con Cloudflare para que tus amigos jueguen desde 
sus casas.

--------------------------------------------------------------------------------
 1. ¿QUÉ ES ESTE PROYECTO?
--------------------------------------------------------------------------------
Este proyecto es un **Panel Web de Control para Servidores de Minecraft**.
Te permite crear, iniciar, detener, gestionar archivos y ver la consola de tus 
servidores de Minecraft desde cualquier navegador web sin necesidad de tocar 
pantallas de comandos complicadas.

Soporta dos ediciones de Minecraft:
  • ☕ Java Edition (Vanilla, PaperMC para plugins, Fabric y Forge para mods).
  • 🪨 Bedrock Edition (para jugadores en móvil, Windows 10/11 y consolas).


--------------------------------------------------------------------------------
 2. CÓMO INICIAR EL PROYECTO PASO A PASO
--------------------------------------------------------------------------------

Paso 1: Abrir la consola en la carpeta del proyecto
  • Abre la carpeta del proyecto en Windows.
  • Haz clic derecho en una zona vacía y selecciona "Abrir en Terminal" o 
    "Abrir PowerShell".

Paso 2: Instalar dependencias (Solo la primera vez)
  Escribe el siguiente comando y presiona Enter:
    npm run install:all

Paso 3: Encender el panel web
  Escribe el siguiente comando y presiona Enter:
    npm run dev

Paso 4: Abrir la web
  Abre tu navegador web (Chrome, Edge, Firefox, Brave...) e ingresa a:
    http://localhost:5173

  Datos de acceso iniciales:
    • Usuario: admin
    • Contraseña: admin


--------------------------------------------------------------------------------
 3. CÓMO CREAR Y GESTIONAR SERVIDORES
--------------------------------------------------------------------------------

1. En la pantalla principal, haz clic en "+ Create Server".
2. Elige la Edición:
   - ☕ Java Edition: Elige la versión (ej. 1.20.4, 1.21) y el tipo de software:
       • Vanilla: Servidor original de Mojang.
       • PaperMC: El más recomendado para evitar lag y añadir Plugins.
       • Fabric / Forge: Para añadir Mods tradicionales (.jar).
   - 🪨 Bedrock Edition: Elige la versión de Bedrock Dedicated Server.
3. Escribe un Nombre para tu servidor y pulsa "Create Server".
4. La web descargará automáticamente todo lo necesario.
5. Haz clic en "▶ Start" para encender el servidor.


--------------------------------------------------------------------------------
 4. MODS, PLUGINS Y ARCHIVOS
--------------------------------------------------------------------------------

Dentro de la ficha de cada servidor, haz clic en la pestaña "📁 Files & Mods / Plugins":

  • Para Servidores Java:
    - Plugins: Sube tus archivos .jar dentro de la carpeta `plugins/`.
    - Mods: Sube tus archivos .jar dentro de la carpeta `mods/`.

  • Para Servidores Bedrock:
    - Behavior Packs (Comportamiento): Sube tus packs en `behavior_packs/`.
    - Resource Packs (Texturas): Sube tus packs en `resource_packs/`.


--------------------------------------------------------------------------------
 5. CÓMO ABRIR PUERTOS PARA QUE AMIGOS ENTREN DESDE FUERA (PORT FORWARDING)
--------------------------------------------------------------------------------

Para que personas fuera de tu casa se puedan conectar a tu servidor, debes abrir 
los puertos en tu Router (redigirlos a la IP local de tu ordenador):

  1. Entra a la web de tu Router (suele ser http://192.168.1.1 o http://192.168.0.1).
  2. Busca la sección llamada "Port Forwarding", "Servidores Virtuales" o "Reenvío de Puertos".
  3. Redirige los puertos hacia la IP local de tu PC:
       • Para Servidores Java: Puerto 25565 en protocolo TCP.
       • Para Servidores Bedrock: Puerto 19132 en protocolo UDP.


--------------------------------------------------------------------------------
 6. CÓMO CONFIGURAR UN DOMINIO PERSONALIZADO Y CLOUDFLARE
--------------------------------------------------------------------------------

Un dominio es un nombre fácil de recordar (ejemplo: `mc.tudominio.com`) para que tus 
amigos no tengan que memorizar números de IP.

--- PASO A: Averiguar tu IP Pública ---
1. Entra en tu navegador a: https://www.cualesmiip.com
2. Verás una dirección como: 186.123.45.67 (Esa es la IP pública de tu casa).

--- PASO B: Configurar el Dominio en tu proveedor (DigitalPlat / GoDaddy / etc.) ---
1. Entra al panel de control de tu dominio en la web donde lo compraste.
2. Ve a "Gestión de DNS" o "Editor de Zonas".
3. Añade un nuevo Registro con estos datos:
     • Tipo: A
     • Nombre/Host: mc (para que sea mc.tudominio.com)
     • Valor/IP: Tu IP pública (ej. 186.123.45.67)
4. Guarda los cambios.

--- PASO C: Guardar el Dominio en el Panel Web ---
1. En tu panel web del proyecto, ve a la pestaña superior "🌐 Red y Dominio".
2. Escribe tu dominio (ej: `mc.tudominio.com`) en la casilla "Nombre de Dominio".
3. La web comprobará automáticamente si el dominio ya apunta a tu IP pública (🟢 DNS Correcto).
4. A partir de ahora, en la ficha de tus servidores verás el botón 
   "📋 Copiar Dirección de Conexión" que genera automáticamente la dirección 
   para tus amigos.

--- PASO D: Cloudflare DDNS (Actualización Automática si cambia la IP de tu casa) ---
La mayoría de las empresas de internet cambian la IP de tu casa de vez en cuando. 
Si usas Cloudflare para gestionar tus DNS, la web puede actualizar tu dominio sola:

1. Añade tu dominio a Cloudflare (es 100% gratuito).
2. En Cloudflare, ve a tu perfil ➔ "API Tokens" ➔ "Create Token" ➔ usa la plantilla "Edit zone DNS".
3. Copia el **API Token** generado.
4. En el resumen del dominio en Cloudflare, copia el **Zone ID**.
5. En el panel web del proyecto, ve a "🌐 Red y Dominio" ➔ seccion "Cloudflare DDNS".
6. Pega tu **Zone ID** y **API Token** y guarda los cambios.
7. Haz clic en "⚡ Sincronizar DNS en Cloudflare Ahora". 
   ¡A partir de ese momento, la web mantendrá tu dominio siempre actualizado!


--------------------------------------------------------------------------------
 7. CONSEJOS IMPORTANTES DE SEGURIDAD
--------------------------------------------------------------------------------

1. Cambia la contraseña de Administrador:
   - Ve a la pestaña "👥 Gestión de Cuentas (Admin)" y cambia la clave `admin`.

2. Resguardos y Copias de Seguridad:
   - Todas los datos de los servidores se guardan dentro de la carpeta `servers/` 
     en la raíz de este proyecto. Puedes hacer una copia de esa carpeta para 
     respaldar todos tus mundos.

================================================================================
                         ¡DISFRUTA DE TUS SERVIDORES!
================================================================================
