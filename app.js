const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
    store: new pgSession({
        pool: pgPool,
        tableName: 'session',
        createTableIfMissing: true
    }),
}));

const adminRoutes = require("./routes/admin");
const shopRoutes = require('./routes/shop');
const checkoutRoutes = require('./routes/checkout');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const addressesRoutes = require('./routes/addresses');
const ordersRoutes = require('./routes/orders');
const productApiRoutes = require('./routes/api/products');
const cartApiRoutes = require('./routes/api/cart');
const errorHandler = require('./middleware/errorHandler');

app.use("/admin", adminRoutes);
app.use('/', shopRoutes);
app.use('/', checkoutRoutes);
app.use('/', authRoutes);
app.use('/', accountRoutes);
app.use('/', addressesRoutes);
app.use('/', ordersRoutes);
app.use('/api/products', productApiRoutes);
app.use('/api/cart', cartApiRoutes);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});