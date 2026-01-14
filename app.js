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
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const productApiRoutes = require('./routes/api/products');
const cartApiRoutes = require('./routes/api/cart');

app.use("/admin", adminRoutes);
app.use('/', shopRoutes);
app.use('/', authRoutes);
app.use('/', accountRoutes);
app.use('/api/products', productApiRoutes);
app.use('/api/cart', cartApiRoutes);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});