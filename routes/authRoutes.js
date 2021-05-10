import express from "express";
import { uploadProfilePicture } from "../utils/fileUpload.js";
import {
  loginUser,
  registerUser,
  googleLogin,
  generateOtp,
  verifyOtp,
  generateGoogleURL,
  logoutUser,
  generateFacebookUrl,
  facebookLogin,
} from "../controllers/authController.js";
import {
  checkGuest,
  validateNewUserToken,
  validateToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/google", googleLogin);
router.get("/google/url", generateGoogleURL);

router.get("/facebook", generateFacebookUrl);
router.get("/facebook/url", facebookLogin);

router.get("/otp/:method", validateNewUserToken, generateOtp);
router.get("/logout", validateToken, logoutUser);

router.post(
  "/register",
  checkGuest,
  uploadProfilePicture.single("profilePic"),
  registerUser
);
router.post("/login", checkGuest, loginUser);
router.post("/otp/:method", validateNewUserToken, verifyOtp);

export default router;
