const express = require('express');
const router = express.Router();

const ProductModel = require('../../models/productModel');
const PageModel = require('../../models/pageModel');
const attachUser = require('../../middleware/attachUser');
const attachStoreNavigation = require('../../middleware/attachStoreNavigation');
const prisma = require('../../prisma/prismaClient');
const sanitizeHtml = require('sanitize-html');

router.use(attachUser);
router.use(attachStoreNavigation);

const normalizeBannerLink = (value) => {
    const link = (value ?? '').toString().trim();
    if (!link) return null;
    if (link.startsWith('/')) return link;
    if (/^https?:\/\//i.test(link)) return link;
    return null;
};

router.get('/', async (req, res) => {
    try {
        const banners = await prisma.banner.findMany({
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                imagePath: true,
                caption: true,
                content: true,
                button: true,
                link: true,
                order: true,
            },
        });

        res.render('index', {
            title: 'Home | Voucher Shop',
            activePage: 'home',
            banners: (banners || []).map((b) => ({
                id: b.id,
                imagePath: b.imagePath || null,
                caption: b.caption || null,
                content: b.content || null,
                button: b.button || null,
                link: normalizeBannerLink(b.link),
            })),
        });
    } catch (error) {
        console.error('Error loading banners for homepage:', error);
        res.render('index', {
            title: 'Home | Voucher Shop',
            activePage: 'home',
            banners: [],
        });
    }
});

router.get('/shop', async (req, res) => {
    try {
        const products = await ProductModel.findAll();
        res.render('shop', {
            title: 'Shop | Voucher Shop',
            activePage: 'shop',
            products: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('shop', {
            title: 'Shop | Voucher Shop',
            activePage: 'shop',
            products: [],
            error: 'Error loading products'
        });
    }
});

router.get('/shop-single/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const product = await ProductModel.findProduct({ slug });

        if (!product) {
            return res.status(404).render('shop-single', {
                title: 'Product Not Found | Voucher Shop',
                activePage: 'shop',
                product: null,
                error: 'Product not found'
            });
        }

        res.render('shop-single', {
            title: `${product.name} | Voucher Shop`,
            activePage: 'shop',
            product: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).render('shop-single', {
            title: 'Product Details | Voucher Shop',
            activePage: 'shop',
            product: null,
            error: 'Error loading product'
        });
    }
});

router.get('/p/:url', async (req, res) => {
    try {
        const url = req.params.url;
        const page = await PageModel.findActiveByUrl(url);

        if (!page) {
            return res.status(404).render('page', {
                title: 'Page Not Found | Voucher Shop',
                activePage: '',
                page: { title: 'Page not found', content: null, imagePath: null },
            });
        }

        const sanitizedContent = page && page.content
            ? sanitizeHtml(page.content, {
                allowedTags: [
                    'p', 'br', 'hr',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'strong', 'b', 'em', 'i', 'u', 's',
                    'blockquote',
                    'ul', 'ol', 'li',
                    'a',
                    'span',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'pre', 'code'
                ],
                allowedAttributes: {
                    a: ['href', 'name', 'target', 'rel'],
                    '*': ['style']
                },
                allowedSchemes: ['http', 'https', 'mailto'],
                allowedStyles: {
                    '*': {
                        'text-decoration': [/^underline$/],
                        'text-align': [/^(left|right|center|justify)$/],
                        'font-weight': [/^(bold|bolder|lighter|[1-9]00)$/],
                        'font-style': [/^italic$/]
                    }
                },
                transformTags: {
                    'a': (tagName, attribs) => {
                        const attrs = { ...attribs };
                        if (attrs.target === '_blank' && !attrs.rel) {
                            attrs.rel = 'noopener noreferrer';
                        }
                        return { tagName, attribs: attrs };
                    }
                }
            })
            : null;

        const safePage = page ? { ...page, content: sanitizedContent } : page;

        res.render('page', {
            title: `${page.title} | Voucher Shop`,
            activePage: '',
            page: safePage,
        });
    } catch (error) {
        console.error('Error fetching CMS page:', error);
        res.status(500).render('page', {
            title: 'Error | Voucher Shop',
            activePage: '',
            page: { title: 'Error', content: null, imagePath: null },
        });
    }
});

module.exports = router;
