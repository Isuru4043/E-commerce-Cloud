import express from "express";
const router = express.Router();
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  getTopProducts,
} from "../controllers/productController.js";

import { protect, admin } from "../middleware/authMiddleware.js";
import { validateProduct, validateObjectId } from "../middleware/validateInput.js";

router.route("/").get(getProducts).post(protect, admin, createProduct);
router.get("/top", getTopProducts);
router.route("/:id")
  .get(validateObjectId, getProductById)
  .put(protect, admin, validateObjectId, validateProduct, updateProduct);

export default router;
