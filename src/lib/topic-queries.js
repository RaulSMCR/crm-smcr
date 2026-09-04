import { prisma } from "@/lib/prisma";
import { TARIFA_VIGENTE, rangoDePrecios } from "@/lib/service-pricing";

const PUBLIC_TOPIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  title: true,
  subtitle: true,
  excerpt: true,
  status: true,
  heroImage: true,
  heroImageAlt: true,
  introVideoUrl: true,
  podcastUrl: true,
  metaTitle: true,
  metaDescription: true,
  featured: true,
  publishedAt: true,
  updatedAt: true,
};

const PUBLIC_POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  coverImageAlt: true,
  createdAt: true,
  author: { select: { specialty: true, user: { select: { name: true } } } },
};

const PUBLIC_SERVICE_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  durationMin: true,
  bannerImage: true,
  professionalAssignments: {
    where: {
      status: "APPROVED",
      rates: { some: TARIFA_VIGENTE },
      professional: {
        is: {
          isApproved: true,
          user: { is: { isActive: true } },
          availability: { some: {} },
        },
      },
    },
    select: {
      rates: { where: TARIFA_VIGENTE, select: { approvedPrice: true } },
      professional: {
        select: {
          id: true,
          slug: true,
          specialty: true,
          bio: true,
          user: { select: { name: true, image: true } },
        },
      },
    },
  },
};

function mapProfessionals(services) {
  const seen = new Set();
  const professionals = [];

  for (const topicService of services || []) {
    for (const assignment of topicService.service.professionalAssignments || []) {
      const profile = assignment.professional;
      if (!profile || seen.has(profile.id)) continue;
      seen.add(profile.id);
      professionals.push({
        ...profile,
        serviceId: topicService.service.id,
        serviceTitle: topicService.service.title,
        range: rangoDePrecios(assignment.rates),
      });
    }
  }

  return professionals;
}

function mapPublicTopic(topic) {
  if (!topic) return null;

  const articles = topic.posts.map((item) => ({
    ...item.post,
    role: item.role,
    featured: item.featured,
    position: item.position,
  }));
  const services = topic.services.map((item) => ({
    ...item,
    ...item.service,
    range: rangoDePrecios(item.service.professionalAssignments.flatMap((assignment) => assignment.rates)),
    professionals: item.service.professionalAssignments.map((assignment) => ({
      ...assignment.professional,
      range: rangoDePrecios(assignment.rates),
    })),
  }));

  const related = new Map();
  for (const relation of topic.relationsFrom) related.set(relation.targetTopic.id, relation.targetTopic);
  for (const relation of topic.relationsTo) related.set(relation.sourceTopic.id, relation.sourceTopic);

  return {
    ...topic,
    articles,
    featuredArticles: articles.filter((article) => article.featured || article.role === "PRIMARY"),
    exploreArticles: articles.filter((article) => !article.featured && article.role !== "PRIMARY"),
    services,
    professionals: mapProfessionals(topic.services),
    relatedTopics: [...related.values()],
    perspectives: topic.perspectives,
    sections: topic.sections,
    faqs: topic.faqs,
  };
}

export async function getPublishedTopicBySlug(slug) {
  const topic = await prisma.topic.findFirst({
    where: { slug: String(slug || ""), status: "PUBLISHED", isActive: true },
    select: {
      ...PUBLIC_TOPIC_SELECT,
      sections: {
        orderBy: { position: "asc" },
      },
      posts: {
        where: { status: "APPROVED", post: { status: "PUBLISHED", noindex: false } },
        orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
        include: { post: { select: PUBLIC_POST_SELECT } },
      },
      services: {
        where: { service: { isActive: true, noindex: false } },
        orderBy: [{ featured: "desc" }, { position: "asc" }],
        include: { service: { select: PUBLIC_SERVICE_SELECT } },
      },
      perspectives: {
        where: { status: "PUBLISHED", discipline: { is: { isActive: true, status: "ACTIVE" } } },
        orderBy: { position: "asc" },
        include: { discipline: { select: { id: true, name: true, slug: true, description: true } } },
      },
      faqs: { where: { isVisible: true }, orderBy: { position: "asc" } },
      relationsFrom: {
        where: { targetTopic: { status: "PUBLISHED", isActive: true } },
        orderBy: { position: "asc" },
        include: { targetTopic: { select: PUBLIC_TOPIC_SELECT } },
      },
      relationsTo: {
        where: { sourceTopic: { status: "PUBLISHED", isActive: true } },
        orderBy: { position: "asc" },
        include: { sourceTopic: { select: PUBLIC_TOPIC_SELECT } },
      },
    },
  });

  return mapPublicTopic(topic);
}

export async function getTopicPreviewById(id) {
  const topic = await prisma.topic.findUnique({
    where: { id: String(id || "") },
    select: {
      ...PUBLIC_TOPIC_SELECT,
      sections: { orderBy: { position: "asc" } },
      posts: {
        where: { status: "APPROVED", post: { status: "PUBLISHED", noindex: false } },
        orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
        include: { post: { select: PUBLIC_POST_SELECT } },
      },
      services: {
        where: { service: { isActive: true, noindex: false } },
        orderBy: [{ featured: "desc" }, { position: "asc" }],
        include: { service: { select: PUBLIC_SERVICE_SELECT } },
      },
      perspectives: {
        where: { status: { not: "ARCHIVED" }, discipline: { is: { isActive: true, status: "ACTIVE" } } },
        orderBy: { position: "asc" },
        include: { discipline: { select: { id: true, name: true, slug: true, description: true } } },
      },
      faqs: { where: { isVisible: true }, orderBy: { position: "asc" } },
      relationsFrom: { orderBy: { position: "asc" }, include: { targetTopic: { select: PUBLIC_TOPIC_SELECT } } },
      relationsTo: { orderBy: { position: "asc" }, include: { sourceTopic: { select: PUBLIC_TOPIC_SELECT } } },
    },
  });
  return mapPublicTopic(topic);
}

const ADMIN_TOPIC_INCLUDE = {
  sections: { orderBy: { position: "asc" } },
  posts: {
    orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    include: { post: { select: { id: true, title: true, slug: true, status: true } } },
  },
  services: {
    orderBy: [{ featured: "desc" }, { position: "asc" }],
    include: { service: { select: { id: true, title: true, slug: true, isActive: true } } },
  },
  perspectives: {
    orderBy: { position: "asc" },
    include: { discipline: { select: { id: true, name: true, slug: true } } },
  },
  faqs: { orderBy: { position: "asc" } },
  relationsFrom: {
    orderBy: { position: "asc" },
    include: { targetTopic: { select: { id: true, name: true, slug: true, status: true } } },
  },
  relationsTo: {
    orderBy: { position: "asc" },
    include: { sourceTopic: { select: { id: true, name: true, slug: true, status: true } } },
  },
};

export async function getTopicForAdmin(id) {
  return prisma.topic.findUnique({ where: { id: String(id || "") }, include: ADMIN_TOPIC_INCLUDE });
}

export async function listTopicsForAdmin() {
  return prisma.topic.findMany({
    orderBy: [{ featured: "desc" }, { order: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { posts: true, sections: true, services: true, perspectives: true, faqs: true } },
    },
  });
}

export async function listTopicEditorOptions() {
  const posts = await prisma.post.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, slug: true, status: true },
  });
  const services = await prisma.service.findMany({
    orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, isActive: true },
  });
  const disciplines = await prisma.discipline.findMany({
    where: { isActive: true, status: "ACTIVE" },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  const topics = await prisma.topic.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, status: true },
  });
  return { posts, services, disciplines, topics };
}
