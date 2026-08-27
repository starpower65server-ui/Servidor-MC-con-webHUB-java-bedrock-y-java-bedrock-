// backend/src/utils/bedrockDownloadResolver.js
//
// FIX: reemplaza cualquier lógica que intente sacar el link de descarga
// de Bedrock haciendo scraping de https://www.minecraft.net/.../bedrock
// Esa página carga los links por JS en el navegador y NO están en el HTML,
// por eso cualquier regex/cheerio sobre esa página devuelve null/undefined
// y la creación del servidor Bedrock falla silenciosamente.
//
// En su lugar, usamos la API oficial de Mojang que expone los links reales:
//   https://net-secondary.web.minecraft-services.net/api/v1.0/download/links

const MOJANG_LINKS_API = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";

// User-Agent requerido: Mojang bloquea clientes sin UA de navegador/tool conocido
const USER_AGENT = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; BEDROCK-UPDATER)";

const DOWNLOAD_TYPES = {
  linux: "serverBedrockLinux",
  windows: "serverBedrockWindows",
  linuxPreview: "serverBedrockPreviewLinux",
  windowsPreview: "serverBedrockPreviewWindows",
};

/**
 * Obtiene el link de descarga actual del Bedrock Dedicated Server.
 * @param {"linux"|"windows"|"linuxPreview"|"windowsPreview"} platform
 * @returns {Promise<{version: string, downloadUrl: string}>}
 */
async function getBedrockDownloadUrl(platform = "linux") {
  const downloadType = DOWNLOAD_TYPES[platform];
  if (!downloadType) {
    throw new Error(`Plataforma Bedrock desconocida: ${platform}`);
  }

  const res = await fetch(MOJANG_LINKS_API, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(
      `No se pudo contactar la API de Mojang (status ${res.status}). ` +
      `Puede que esté caída temporalmente o bloqueada por tu firewall/VPS.`
    );
  }

  const data = await res.json();
  const link = data?.result?.links?.find((l) => l.downloadType === downloadType);

  if (!link || !link.downloadUrl) {
    throw new Error(
      `La API de Mojang no devolvió un link para "${downloadType}". ` +
      `Puede que Mojang haya cambiado el formato de la respuesta.`
    );
  }

  // La versión viene embebida en el nombre del zip, ej:
  // https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.124.2.zip
  const versionMatch = link.downloadUrl.match(/bedrock-server-([\d.]+)\.zip/);
  const version = versionMatch ? versionMatch[1] : "unknown";

  return { version, downloadUrl: link.downloadUrl };
}

module.exports = { getBedrockDownloadUrl, DOWNLOAD_TYPES };

// ────────────────────────────────────────────────────────────────
// Ejemplo de uso en la ruta de creación de servidores:
//
//   const { getBedrockDownloadUrl } = require("../utils/bedrockDownloadResolver");
//
//   router.post("/servers", async (req, res) => {
//     try {
//       if (req.body.edition === "bedrock") {
//         const platform = process.platform === "win32" ? "windows" : "linux";
//         const { version, downloadUrl } = await getBedrockDownloadUrl(platform);
//         // ...descargar downloadUrl y descomprimir en servers/<nombre>/
//       }
//       res.json({ success: true });
//     } catch (err) {
//       // IMPORTANTE: loguea el error real en vez de solo redirigir al form.
//       console.error("[create-server:bedrock]", err);
//       res.status(500).json({ success: false, message: err.message });
//     }
//   });
// ────────────────────────────────────────────────────────────────
