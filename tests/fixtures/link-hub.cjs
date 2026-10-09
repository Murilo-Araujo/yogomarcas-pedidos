const { randomUUID } = require('node:crypto');
const link = (values = {}) => ({ id: randomUUID(), title: 'Catálogo', subtitle: 'Nossos sabores', url: 'https://pedidos.yogomarcas.com.br/catalogo', icon: 'catalog', image_url: '/assets/catalog-expresso-italiano-v1.webp', badge: '', style: 'featured', enabled: true, starts_at: null, ends_at: null, ...values });
const config = (values = {}) => ({ title: 'Yogomarcas', bio: 'Grandes resultados começam na base.', tagline: 'Para o seu negócio.', logo_url: '/assets/logo.png', background_color: '#f7f4fb', accent_color: '#51358b', footer: 'Paraná', public_url: '', links: [link()], ...values });
module.exports = { link, config };
