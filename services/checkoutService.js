const prisma = require('../prisma/prismaClient');
const { Prisma } = require('@prisma/client');
const { normalizeText } = require('../utils/text');
const { decimalToNumber } = require('../utils/number');
const { repairCartPrices, priceCartForOrder } = require('./cartPricingService');

const validatePostalCode = (postalCode, countryRaw) => {
    const country = normalizeText(countryRaw) ?? '';
    const pc = normalizeText(postalCode) ?? '';
    const isPL = /^(pl|poland|polska)$/i.test(country);
    if (isPL) return /^\d{2}-\d{3}$/.test(pc);
    return /^[A-Za-z0-9\s-]{2,15}$/.test(pc);
};

const calculateCartTotal = (cart) => {
    return (cart || []).reduce(
        (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)),
        0
    );
};

const getDeliveryAddressesForUser = async (userId) => {
    try {
        return await prisma.userAddress.findMany({
            where: { userId, type: 'delivery' },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
    } catch (error) {
        console.error('Error fetching delivery addresses for checkout:', error);
        return [];
    }
};

const getCheckoutPageData = async ({ userId, cart }) => {
    if (!Array.isArray(cart) || !cart.length) {
        return { redirect: '/cart?reason=empty' };
    }

    try {
        await repairCartPrices(cart);
    } catch (error) {
        console.error('Error repairing checkout cart prices:', error);
    }

    const deliveryAddresses = await getDeliveryAddressesForUser(userId);

    const defaultAddress = deliveryAddresses.find((a) => a && a.isDefault) || null;
    const defaultChoice = defaultAddress ? String(defaultAddress.id) : 'new';

    const total = calculateCartTotal(cart);

    return {
        cart,
        total,
        deliveryAddresses,
        errors: null,
        formData: {
            paymentMethod: 'BANK_TRANSFER',
            deliveryMethod: 'E_DELIVERY',
            deliveryAddressChoice: defaultChoice,
            shippingStreet: defaultAddress?.street || '',
            shippingCity: defaultAddress?.city || '',
            shippingPostalCode: defaultAddress?.postalCode || '',
            shippingCountry: defaultAddress?.country || 'Poland',
        },
    };
};

const placeCheckoutOrder = async ({ userId, cart, body }) => {
    if (!Array.isArray(cart) || !cart.length) {
        return { ok: false, redirect: '/cart?reason=empty' };
    }

    try {
        await repairCartPrices(cart);
    } catch (error) {
        console.error('Error repairing checkout cart prices:', error);
    }

    const paymentMethod = (body?.paymentMethod || '').trim();
    const deliveryMethod = (body?.deliveryMethod || '').trim();
    const allowedDelivery = new Set(['E_DELIVERY', 'COURIER']);

    const errors = [];
    if (!allowedDelivery.has(deliveryMethod)) {
        errors.push({ msg: 'Please select a valid delivery method.' });
    }

    const allowedPaymentByDelivery = {
        E_DELIVERY: new Set(['BANK_TRANSFER', 'PAYPAL']),
        COURIER: new Set(['CASH', 'CARD']),
    };
    const allowedPayment = allowedPaymentByDelivery[deliveryMethod] || new Set();
    if (!allowedPayment.has(paymentMethod)) {
        errors.push({ msg: 'Please select a valid payment method for the chosen delivery method.' });
    }

    const deliveryAddressChoice = normalizeText(body?.deliveryAddressChoice) ?? '';
    const shippingStreet = normalizeText(body?.shippingStreet) ?? '';
    const shippingCity = normalizeText(body?.shippingCity) ?? '';
    const shippingPostalCode = normalizeText(body?.shippingPostalCode) ?? '';
    const shippingCountry = normalizeText(body?.shippingCountry) ?? '';

    const deliveryPriceNumber = deliveryMethod === 'COURIER' ? 15.0 : 0.0;
    const paymentPriceNumber = 0.0;

    const deliveryAddresses = await getDeliveryAddressesForUser(userId);

    let deliveryAddressId = null;
    if (deliveryMethod === 'COURIER') {
        const chosenId = Number.parseInt(deliveryAddressChoice, 10);
        const choosingExisting = Number.isFinite(chosenId) && chosenId > 0;

        if (choosingExisting) {
            const owned = deliveryAddresses.find((a) => a && a.id === chosenId);
            if (!owned) {
                errors.push({ msg: 'Please select a valid delivery address.' });
            } else {
                deliveryAddressId = owned.id;
            }
        } else {
            if (shippingStreet.length < 3 || shippingStreet.length > 120) {
                errors.push({ msg: 'Street is required (3–120 chars).' });
            }
            if (shippingCity.length < 2 || shippingCity.length > 80) {
                errors.push({ msg: 'City is required (2–80 chars).' });
            }
            if (shippingCountry.length < 2 || shippingCountry.length > 80) {
                errors.push({ msg: 'Country is required (2–80 chars).' });
            }
            if (!validatePostalCode(shippingPostalCode, shippingCountry)) {
                const isPL = /^(pl|poland|polska)$/i.test(shippingCountry);
                errors.push({
                    msg: isPL
                        ? 'Postal code must be in format 00-000 (PL).'
                        : 'Postal code must be 2–15 chars (letters/numbers/spaces/-).',
                });
            }
        }
    }

    const totalForError = calculateCartTotal(cart) + deliveryPriceNumber + paymentPriceNumber;

    if (errors.length) {
        return {
            ok: false,
            status: 400,
            viewData: {
                cart,
                total: totalForError,
                errors,
                deliveryAddresses,
                formData: {
                    paymentMethod,
                    deliveryMethod,
                    deliveryAddressChoice: deliveryAddressChoice || 'new',
                    shippingStreet,
                    shippingCity,
                    shippingPostalCode,
                    shippingCountry,
                },
            },
        };
    }

    try {
        if (deliveryMethod === 'COURIER' && !deliveryAddressId) {
            const created = await prisma.userAddress.create({
                data: {
                    userId,
                    street: shippingStreet,
                    city: shippingCity,
                    postalCode: shippingPostalCode,
                    country: shippingCountry,
                    type: 'delivery',
                    isDefault: false,
                },
            });
            deliveryAddressId = created.id;
        }

        const priced = await priceCartForOrder(cart);
        if (!priced.ok) {
            return {
                ok: false,
                status: 400,
                viewData: {
                    cart,
                    total: totalForError,
                    errors: [{ msg: priced.error }],
                    deliveryAddresses,
                    formData: { paymentMethod, deliveryMethod },
                },
            };
        }

        const pricedItems = priced.items;

        const itemsTotal = pricedItems.reduce((sum, it) => sum + (Number(it.lineFinal) || 0), 0);
        const total = itemsTotal + deliveryPriceNumber + paymentPriceNumber;

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.order.create({
                data: {
                    userId,
                    deliveryAddressId: deliveryMethod === 'COURIER' ? deliveryAddressId : null,
                    totalPrice: new Prisma.Decimal(total.toFixed(2)),
                    status: 'PLACED',
                    paymentMethod,
                    paymentPrice: new Prisma.Decimal(paymentPriceNumber.toFixed(2)),
                    paymentStatus: 'UNPAID',
                    deliveryMethod,
                    deliveryPrice: new Prisma.Decimal(deliveryPriceNumber.toFixed(2)),
                    items: {
                        create: pricedItems.flatMap((it) => {
                            const perUnit = [];
                            for (let i = 0; i < it.qty; i++) {
                                const rec = Array.isArray(it.recipients) ? it.recipients[i] : null;
                                perUnit.push({
                                    productId: it.productId,
                                    quantity: 1,
                                    unitPrice: new Prisma.Decimal(Number(it.unitBase || 0).toFixed(2)),
                                    vat: new Prisma.Decimal(Number(it.vat || 0).toFixed(2)),
                                    finalPrice: new Prisma.Decimal(Number(it.unitFinal || 0).toFixed(2)),
                                    selectedAttributes:
                                        it.selectedAttributes && it.selectedAttributes.length ? it.selectedAttributes : null,
                                    recipientName: rec?.recipientName ?? null,
                                    dedication: rec?.dedication ?? null,
                                    status: 'ACTIVE',
                                });
                            }
                            return perUnit;
                        }),
                    },
                },
                include: { items: true },
            });

            return createdOrder;
        });

        return {
            ok: true,
            orderId: order.id,
        };
    } catch (error) {
        console.error('Error placing order:', error);
        return {
            ok: false,
            status: 500,
            viewData: {
                cart,
                total: totalForError,
                errors: [{ msg: 'Could not place order. Please try again.' }],
                deliveryAddresses,
                formData: {
                    paymentMethod,
                    deliveryMethod,
                    deliveryAddressChoice: deliveryAddressChoice || 'new',
                    shippingStreet,
                    shippingCity,
                    shippingPostalCode,
                    shippingCountry,
                },
            },
        };
    }
};

const getThankyouPageData = async ({ userId, orderId }) => {
    const resolvedId = Number(orderId);
    if (!Number.isFinite(resolvedId) || resolvedId < 1) {
        return { ok: false, status: 400, error: 'Invalid order id.' };
    }

    const order = await prisma.order.findFirst({
        where: { id: resolvedId, userId },
        include: {
            user: { select: { email: true, name: true } },
            deliveryAddress: true,
            items: {
                include: {
                    product: { select: { name: true, slug: true } },
                },
                orderBy: { id: 'asc' },
            },
        },
    });

    if (!order) {
        return { ok: false, status: 404, error: 'Order not found.' };
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSubtotal = items.reduce((sum, it) => {
        const qty = Number.parseInt(it.quantity, 10) || 0;
        const price = decimalToNumber(it.finalPrice);
        return sum + (qty * price);
    }, 0);

    const deliveryPrice = decimalToNumber(order.deliveryPrice);
    const paymentPrice = decimalToNumber(order.paymentPrice);
    const total = decimalToNumber(order.totalPrice);

    const summary = {
        itemsSubtotal,
        deliveryPrice,
        paymentPrice,
        total,
        items: items.map((it) => ({
            id: it.id,
            productName: it.product?.name || 'Product',
            productSlug: it.product?.slug || null,
            quantity: Number.parseInt(it.quantity, 10) || 0,
            unitPrice: decimalToNumber(it.unitPrice),
            finalPrice: decimalToNumber(it.finalPrice),
            recipientName: it.recipientName || null,
            dedication: it.dedication || null,
            selectedAttributes: it.selectedAttributes || null,
        })),
    };

    return { ok: true, order, summary };
};

module.exports = {
    getCheckoutPageData,
    placeCheckoutOrder,
    getThankyouPageData,
};
