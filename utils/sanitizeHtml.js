const sanitizeHtmlLib = require('sanitize-html');

const sanitizeHtml = (content) => {
    if (!content) return null;

    return sanitizeHtmlLib(content, {
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
    });
};

module.exports = {
    sanitizeHtml,
};
