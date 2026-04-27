/**
 * Product Controller
 * 
 * Thin controller layer — delegates to the service layer.
 */

import asyncHandler from '../middleware/asyncHandler.js';
import * as productService from '../services/productService.js';

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const result = await productService.getProductList({
    keyword: req.query.keyword,
    pageNumber: req.query.pageNumber,
  });
  res.json(result);
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  res.json(product);
});

// @desc    Create a single product
// @route   POST /api/products
// @access  Admin/Private
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createNewProduct(req.user._id);
  res.status(201).json(product);
});

// @desc    Update a single product
// @route   PUT /api/products/:id
// @access  Admin/Private
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProductById(req.params.id, req.body);
  res.status(200).json(product);
});

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = asyncHandler(async (req, res) => {
  const products = await productService.getTopRatedProducts();
  res.json(products);
});

export { getProducts, getProductById, createProduct, updateProduct, getTopProducts };
