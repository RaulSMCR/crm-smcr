const PATIENT_LINKS = {
  profile: { href: "/panel/paciente", label: "Mi perfil", tone: "profile" },
  services: { href: "/servicios", label: "Servicios", tone: "services" },
  blog: { href: "/blog", label: "Blog", tone: "blog" },
};

function isSection(pathname, section) {
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function getPatientHeaderLinks(pathname = "/") {
  const currentPath = String(pathname || "/").split(/[?#]/, 1)[0] || "/";

  if (isSection(currentPath, "/blog")) {
    return [PATIENT_LINKS.profile, PATIENT_LINKS.services];
  }

  if (isSection(currentPath, "/servicios")) {
    return [PATIENT_LINKS.blog, PATIENT_LINKS.profile];
  }

  if (isSection(currentPath, "/panel/paciente") || isSection(currentPath, "/mi")) {
    return [PATIENT_LINKS.services, PATIENT_LINKS.blog];
  }

  return [PATIENT_LINKS.profile, PATIENT_LINKS.services, PATIENT_LINKS.blog];
}
