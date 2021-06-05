import express from "express";
import {
  getMyProfileDetails,
  getProfileDetails,
  getMyTournaments,
  updateUserProfile,
  getMyTransactions,
  getMyWithdrawals,
  getMyReferrals,
} from "../controllers/profileController.js";
import { checkGuest, validateToken } from "../middlewares/authMiddleware.js";
import { uploadProfilePicture } from "../utils/fileUpload.js";

const router = express.Router();

router.get("/", validateToken, getMyProfileDetails);

router.get("/transactions", validateToken, getMyTransactions);

router.get("/withdrawals", validateToken, getMyWithdrawals);

router.get("/referrals", validateToken, getMyReferrals);

router.get("/tournaments", validateToken, getMyTournaments);

router.get("/:id/view", getProfileDetails);

router.post(
  "/update",
  validateToken,
  uploadProfilePicture.single("profilePic"),
  updateUserProfile
);

export default router;
