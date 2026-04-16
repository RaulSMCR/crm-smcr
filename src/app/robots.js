export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/ingresar', '/registro'],
    },
    sitemap: 'https://saludmentalcostarica.com/sitemap.xml',
    host: 'https://saludmentalcostarica.com',
  };
}
