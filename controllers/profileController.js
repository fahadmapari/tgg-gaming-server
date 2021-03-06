import User from "../models/userModel.js";
import Tournament from "../models/tournamentModel.js";
import Order from "../models/orderModel.js";
import Match from "../models/matchModel.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/hashPassword.js";
import Withdrawal from "../models/withdrawModel.js";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Referral from "../models/referralModel.js";
import sgMail from "@sendgrid/mail";

const __dirname = dirname(fileURLToPath(import.meta.url));
sgMail.setApiKey(process.env.SEND_GRID_KEY);

export const getProfileDetails = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!id) return next(new AppError("Profile not found.", 404));

    const profile = await User.find({ _id: id })
      .select("-password -coins")
      .exec();

    if (!profile) return next(new AppError("Profile not found", 404));

    res.status(200).json({
      profile: profile[0],
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const getMyProfileDetails = async (req, res, next) => {
  try {
    res.status(200).json({
      profile: req.user,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const getMyTournaments = async (req, res, next) => {
  const { id } = req.user;
  const { page, limit, status, dateFrom, dateTo } = req.query;
  try {
    if (!id) return next(new AppError("Profile not found.", 404));

    const query = {
      $or: [{ player: id }, { team: req.user.name }],
    };

    if (status && status !== "") query.tournamentStatus = status;

    if (dateFrom && dateFrom !== "") {
      if (!dateTo || dateTo === "") {
        query.createdAt = {
          $gte: startOfDay(new Date(dateFrom)),
          $lte: endOfDay(new Date(dateFrom)),
        };
      } else {
        query.createdAt = {
          $gte: startOfDay(new Date(dateFrom)),
          $lte: endOfDay(new Date(dateTo)),
        };
      }
    }

    let profile = await Match.paginate(query, {
      page: page ? page : 1,
      limit: limit ? limit : 10,
      populate: "tournament game",
      sort: { createdAt: -1 },
    });

    if (!profile) return next(new AppError("Profile not found", 404));

    res.status(200).json({
      tournaments: profile,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const getMyTransactions = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { page, limit } = req.query;

    const transactions = await Order.paginate(
      { user: id },
      {
        page: page ? page : 1,
        limit: limit ? limit : 10,
        sort: { createdAt: -1 },
      }
    );

    res.status(200).json({
      transactions,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const getMyWithdrawals = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { page, limit } = req.query;

    const withdrawals = await Withdrawal.paginate(
      { user: id },
      {
        page: page ? page : 1,
        limit: limit ? limit : 10,
        sort: { createdAt: -1 },
      }
    );

    res.status(200).json({
      withdrawals,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const getMyReferrals = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { page, limit } = req.query;

    const referrals = await Referral.paginate(
      { referredBy: id },
      {
        page: page ? page : 1,
        limit: limit ? limit : 10,
        sort: { createdAt: -1 },
        populate: { path: "referredUser", select: "-password -coins" },
      }
    );

    res.json({
      referrals,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const updateUserProfile = async (req, res, next) => {
  const { name, mobile, email, currentPassword, newPassword } = req.body;

  try {
    let updateDetails = {};
    const foundUser = await User.findOne({ _id: req.user.id });

    const joinedMatches = await Match.find({
      $or: [
        { player: foundUser._id, tournamentStatus: "upcoming" },
        { player: foundUser._id, tournamentStatus: "ongoing" },
      ],
    })
      .limit(1)
      .exec();

    if (joinedMatches.length > 0 && name && name !== foundUser.name) {
      return next(
        new AppError(
          "You can't change your gamername while you have ongoing or upcoming tournaments.",
          403
        )
      );
    }

    if (currentPassword === "" && foundUser.password !== "")
      return next(new AppError("Password is required to update profile", 403));
    if (name && name !== "") updateDetails.name = name;
    if (
      mobile &&
      mobile !== "" &&
      typeof mobile !== "undefined" &&
      mobile !== "undefined"
    )
      updateDetails.mobile = mobile;
    if (email && email !== "") updateDetails.email = email;
    if (newPassword && newPassword !== "") {
      const updatedPassword = await hashPassword(newPassword);
      updateDetails.password = updatedPassword;
    }
    if (req.file)
      updateDetails.profilePic =
        process.env.DOMAIN_NAME + "/profile-pictures/" + req.file.filename;

    if (!foundUser) return next(new AppError("User not found.", 401));

    let authCheck = foundUser.checkPassword(
      currentPassword,
      foundUser.password
    );

    if (
      foundUser.password === "" &&
      email &&
      email !== "" &&
      email !== req.user.email &&
      !newPassword &&
      newPassword === ""
    ) {
      return next(
        new AppError("Please set a password before changing your email.")
      );
    }

    if (authCheck || foundUser.password === "") {
      await User.findOneAndUpdate(
        { _id: req.user.id },
        {
          ...updateDetails,
          mobileVerified:
            mobile && mobile !== req.user.mobile
              ? false
              : req.user.mobileVerified,
          emailVerified:
            email && email !== req.user.email ? false : req.user.emailVerified,
        },
        { runValidators: true, context: "query" }
      );

      try {
        try {
          const oldProfilePicLocation = foundUser.profilePic.split("/");
          fs.unlinkSync(
            path.resolve(
              __dirname,
              `../public/profile-pictures/${
                oldProfilePicLocation[oldProfilePicLocation.length - 1]
              }`
            )
          );
        } catch (err) {
          console.log(err);
        }

        if (mobile || email || newPassword) {
          const msg = {
            to: foundUser.email,
            from: process.env.SEND_GRID_EMAIL, // Use the email address or domain you verified above
            subject: "TSS-GAMING Account update",
            text: `${mobile && `Your mobile numer: ${mobile} was changed`}
                  ${email && `Your email: ${email} was changed, `}
                  ${newPassword && `Your account password was changed.`}
                  `,
          };

          await sgMail.send(msg);
        }
      } catch (err) {
        console.log(err);
      }

      res.json({
        message: "User profile updated",
      });
    } else {
      next(new AppError("Invalid Password", 403));
    }
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const updateProfilePic = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError("Profile pic required.", 401));

    await User.findOneAndUpdate(
      { _id: req.user.id },
      {
        profilePic:
          process.env.DOMAIN_NAME + "/profile-pictures/" + req.file.filename,
      }
    );

    res.json({
      message: "Profile updated",
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};
