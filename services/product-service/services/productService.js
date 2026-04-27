/**
 * Product Service Layer
 * 
 * Encapsulates product business logic separate from HTTP controllers.
 */

import Product from '../models/productModel.js';
import logger from '../utils/logger.js';

export const getProductList = async ({ keyword, pageNumber }) => {
  const pageSize = 8;
  const page = Number(pageNumber) || 1;

  const filter = keyword
    ? { name: { $regex: keyword, $options: 'i' } }
    : {};

  const count = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  return { products, page, pages: Math.ceil(count / pageSize) };
};

export const getProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }
  return product;
};

export const createNewProduct = async (userId) => {
  const product = new Product({
    name: 'sample name',
    price: 0,
    user: userId,
    image: '/images/sample.jpg',
    brand: 'sample brand',
    category: 'sample category',
    countInStock: 0,
    numReviews: 0,
    description: 'sample description',
  });
  const created = await product.save();
  logger.info('Product created', { productId: created._id });
  return created;
};

export const updateProductById = async (id, updates) => {
  const product = await Product.findById(id);
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  product.name = updates.name ?? product.name;
  product.price = updates.price ?? product.price;
  product.image = updates.image ?? product.image;
  product.brand = updates.brand ?? product.brand;
  product.category = updates.category ?? product.category;
  product.countInStock = updates.countInStock ?? product.countInStock;
  product.description = updates.description ?? product.description;

  const updated = await product.save();
  logger.info('Product updated', { productId: updated._id });
  return updated;
};

export const getTopRatedProducts = async (limit = 3) => {
  return Product.find({}).sort({ rating: -1 }).limit(limit);
};

export const updateProductStock = async (productId, quantityOrdered) => {
  const product = await Product.findById(productId);
  if (product) {
    product.countInStock = Math.max(0, product.countInStock - quantityOrdered);
    await product.save();
    logger.info('Stock updated', {
      productId,
      newStock: product.countInStock,
      quantityOrdered,
    });
    return product;
  }
  logger.warn('Product not found for stock update', { productId });
  return null;
};
