const express = require('express');
const router = express.Router();

const PageModel = require('../../models/pageModel');
const { sanitizeHtml } = require('../../utils/sanitizeHtml');

router.get('/:url', async (req, res) => {
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

        const sanitizedContent = sanitizeHtml(page.content);
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
