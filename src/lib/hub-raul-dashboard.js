export const HUB_RAUL_PATH = "/raul-olmedo-evans";
export const HUB_RAUL_CAMPAIGN = "lanzamiento-hub-raul";

function sameCampaign(value) {
  return String(value || "").trim().toLowerCase() === HUB_RAUL_CAMPAIGN;
}

export function isHubRaulAttributed(row) {
  const landingPath = String(row?.landingPath || "");
  return landingPath.includes(HUB_RAUL_PATH) || sameCampaign(row?.campaignName) || sameCampaign(row?.utmCampaign);
}

export function countUniquePatientIds(rows) {
  return new Set(rows.map((row) => row.patientId).filter(Boolean)).size;
}

export function groupHubAppointments(rows) {
  const counts = new Map();
  for (const row of rows) {
    const name = row.topicSlug || "Sin tema especificado";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
