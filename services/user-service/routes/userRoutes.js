import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import { validateRegister, validateLogin, validateProfileUpdate } from "../middleware/validateInput.js";

const router = express.Router();

import {
  authUser,
  registerUser,
  getUserProfile,
  logoutUser,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser,
} from "../controllers/userController.js";

router.route("/").post(validateRegister, registerUser).get(protect, admin, getUsers);
router.post("/auth", validateLogin, authUser);
router.post("/logout", logoutUser);
router
  .route("/profile")
  .get(protect, getUserProfile)
  .put(protect, validateProfileUpdate, updateUserProfile);

router
  .route("/:id")
  .delete(protect, admin, deleteUser)
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser);

export default router;
