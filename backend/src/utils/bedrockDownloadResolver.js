// backend/src/utils/bedrockDownloadResolver.js
//
// Refreshes and resolves Bedrock Dedicated Server download links directly
// from Mojang's official API endpoint to bypass JS scraping issues.

const MOJANG_LINKS_API = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";

// User-Agent required: Mojang blocks requests without a recognized browser/tool User-Agent
const USER_AGENT = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; BEDROCK-UPDATER)";

const DOWNLOAD_TYPES = {
    linux: "serverBedrockLinux",
    windows: "serverBedrockWindows",
    linuxPreview: "serverBedrockPreviewLinux",
    windowsPreview: "serverBedrockPreviewWindows",
};

/**
 * Fetch all available Bedrock download links from Mojang API.
 * @returns {Promise<Array<{downloadType: string, downloadUrl: string}>>}
 */
async function fetchMojangDownloadLinks() {
    const res = await fetch(MOJANG_LINKS_API, {
        headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
        throw new Error(`Failed to contact Mojang API (status ${res.status}).`);
    }

    const data = await res.json();
    return data?.result?.links || [];
}

/**
 * Get current download URL for Bedrock Dedicated Server.
 * @param {"linux"|"windows"|"linuxPreview"|"windowsPreview"} platform
 * @returns {Promise<{version: string, downloadUrl: string}>}
 */
async function getBedrockDownloadUrl(platform = "linux") {
    const downloadType = DOWNLOAD_TYPES[platform] || platform;
    const links = await fetchMojangDownloadLinks();
    const link = links.find((l) => l.downloadType === downloadType);

    if (!link || !link.downloadUrl) {
        throw new Error(`Mojang API did not return a link for "${downloadType}".`);
    }

    const versionMatch = link.downloadUrl.match(/bedrock-server-([\d.]+)\.zip/);
    const version = versionMatch ? versionMatch[1] : "latest";

    return { version, downloadUrl: link.downloadUrl };
}

module.exports = {
    fetchMojangDownloadLinks,
    getBedrockDownloadUrl,
    DOWNLOAD_TYPES,
    USER_AGENT,
};
