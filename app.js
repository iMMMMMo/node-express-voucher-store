const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const shopRoutes = require('./routes/shop');
const productApiRoutes = require('./routes/api/products');

app.use('/', shopRoutes);
app.use('/api/products', productApiRoutes);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});